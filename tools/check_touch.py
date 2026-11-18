"""触控自检：手指在滑轨上拖动时页面不能滚动，在票面其他位置滑动时页面照常滚动。

先启动页面： npm run dev        然后： python3 tools/check_touch.py
依赖： pip install playwright && playwright install chromium webkit

- Chromium + iPhone 模拟：用 CDP 发真实的触摸手势，检查 window.scrollY。
- WebKit（Safari 内核）+ iPhone 模拟：检查页面无报错、touch-action 生效、
  touchstart/touchmove 被 preventDefault、拖动逻辑可用。
说明：这是桌面上的 Safari 内核，不是真机 iOS Safari，最终仍建议用 iPhone 实测一次。
"""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

URL = os.environ.get('TICKET_URL', 'http://localhost:5173/')
SHOTS = Path(__file__).resolve().parent.parent / 'frames'
fails = []


def check(name, ok, detail=''):
    print(('PASS  ' if ok else 'FAIL  ') + name + (f'   [{detail}]' if detail else ''))
    if not ok:
        fails.append(name)


PT = '''([sx,sy])=>{const s=document.getElementById('stage'),r=s.getBoundingClientRect(),vb=s.viewBox.baseVal;
  return [r.left+(sx-vb.x)/vb.width*r.width, r.top+(sy-vb.y)/vb.height*r.height];}'''
SETUP = '''()=>{const d=document.createElement('div'); d.id='spacer'; d.style.height='2000px'; document.body.appendChild(d);
  const s=window.__ticket; s.playing=false; s.time=3.0; window.scrollTo(0,0);}'''


async def open_page(browser, p, device, landscape=False):
    d = dict(p.devices[device])
    if landscape:
        v = d['viewport']
        d['viewport'] = {'width': v['height'], 'height': v['width']}
    ctx = await browser.new_context(**d)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL)
    await pg.evaluate('window.ready')
    await pg.evaluate(SETUP)
    await pg.wait_for_timeout(200)
    return ctx, pg, errs


async def swipe(cdp, pg, x, y, dx, dy, steps=16):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for i in range(1, steps + 1):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove',
                       'touchPoints': [{'x': x + dx * i / steps, 'y': y + dy * i / steps}]})
        await pg.wait_for_timeout(16)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await pg.wait_for_timeout(700)


async def chromium_gestures(p, landscape):
    tag = 'Chromium/iPhone ' + ('横屏' if landscape else '竖屏')
    kw = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
    b = await p.chromium.launch(**kw)
    ctx, pg, errs = await open_page(b, p, 'iPhone 13', landscape)
    cdp = await ctx.new_cdp_session(pg)
    state = lambda: pg.evaluate('({y:window.scrollY,x:window.__ticket.targetX,t:window.__ticket.time,d:window.__ticket.dragging})')
    rider_x = await pg.evaluate('1141')          # 滑轨中段
    rx, ry = await pg.evaluate(PT, [rider_x, 800])
    px, py = await pg.evaluate(PT, [1141, 430])  # 票面图片区域
    dist = min(160, ry - 20)

    # 1) 在滑轨上斜着往左上拖：小人要跟手，页面不能滚
    await swipe(cdp, pg, rx, ry, -90, -dist)
    s = await state()
    check(f'{tag}: 滑轨上斜向拖动，页面不滚动', s['y'] == 0, f"scrollY={s['y']}")
    check(f'{tag}: 滑轨上拖动，小人跟随手指向左', s['x'] < rider_x - 100 and not s['d'], f"targetX={s['x']:.0f}")
    # 2) 在滑轨上纯竖直滑：页面也不能滚
    await swipe(cdp, pg, rx, ry, 0, -dist)
    s = await state()
    check(f'{tag}: 滑轨上竖直滑动，页面不滚动', s['y'] == 0, f"scrollY={s['y']}")
    # 3) 对照：在票面图片上同样往上滑，页面应该正常滚动
    await swipe(cdp, pg, px, py, -90, -min(160, py - 20))
    s2 = await state()
    check(f'{tag}: 票面其他位置上滑，页面正常滚动（对照）', s2['y'] > 30, f"scrollY={s2['y']}")
    check(f'{tag}: 票面其他位置滑动不会移动小人', abs(s2['x'] - s['x']) < 1)
    check(f'{tag}: 无脚本报错', not errs, '; '.join(errs))
    await b.close()


async def webkit_checks(p, landscape):
    tag = 'WebKit/iPhone ' + ('横屏' if landscape else '竖屏')
    b = await p.webkit.launch()
    ctx, pg, errs = await open_page(b, p, 'iPhone 13', landscape)
    check(f'{tag}: 无脚本报错', not errs, '; '.join(errs))
    ta = await pg.evaluate("getComputedStyle(document.getElementById('railHit')).touchAction")
    check(f'{tag}: 滑轨 touch-action 为 none', ta == 'none', ta)
    over = await pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    check(f'{tag}: 页面没有横向溢出', over <= 0, f'overflow={over}px')
    # 合成触摸事件：滑轨上应被 preventDefault，票面图片上不应被拦截
    res = await pg.evaluate('''()=>{
      const fire=(el,type)=>{const r=el.getBoundingClientRect();
        let ev; try{const t=new Touch({identifier:1,target:el,clientX:r.left+r.width/2,clientY:r.top+r.height/2});
          ev=new TouchEvent(type,{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]});}
        catch(e){ev=new Event(type,{bubbles:true,cancelable:true});}
        el.dispatchEvent(ev); return ev.defaultPrevented;};
      const rail=document.getElementById('railHit'), pic=document.querySelector('#scene image');
      return {railStart:fire(rail,'touchstart'),railMove:fire(rail,'touchmove'),picStart:fire(pic,'touchstart'),picMove:fire(pic,'touchmove')};}''')
    check(f'{tag}: 滑轨 touchstart/touchmove 被 preventDefault', res['railStart'] and res['railMove'], str(res))
    check(f'{tag}: 票面其他位置的触摸不被拦截', not res['picStart'] and not res['picMove'])
    # 合成指针事件：拖动逻辑
    x0, y0 = await pg.evaluate(PT, [1141, 800])
    x1, _ = await pg.evaluate(PT, [800, 800])
    out = await pg.evaluate('''([x0,y0,x1])=>{const el=document.getElementById('railHit');
      const ev=(type,x)=>el.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:y0}));
      ev('pointerdown',x0); ev('pointermove',x1); const mid={x:window.__ticket.targetX-window.__ticket.grabDX,d:window.__ticket.dragging};
      ev('pointerup',x1); return {mid,endDragging:window.__ticket.dragging};}''', [x0, y0, x1])
    check(f'{tag}: 拖动时小人跟到手指位置，松手结束', abs(out['mid']['x'] - 800) < 2 and out['mid']['d'] and not out['endDragging'], str(out))
    await pg.wait_for_timeout(600)
    SHOTS.mkdir(exist_ok=True)
    await pg.screenshot(path=str(SHOTS / f"webkit-{'landscape' if landscape else 'portrait'}.png"))
    await b.close()


async def main():
    async with async_playwright() as p:
        for landscape in (False, True):
            await chromium_gestures(p, landscape)
            await webkit_checks(p, landscape)
    print('\n' + ('全部通过' if not fails else f'{len(fails)} 项未通过'))
    sys.exit(1 if fails else 0)

asyncio.run(main())
