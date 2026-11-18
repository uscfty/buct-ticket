"""把动画逐帧截图并（可选）编码成 MP4。

先在项目根目录启动页面：  npm run dev
然后：
  python3 tools/render.py                 # 输出 frames/f0000.png ... 并用 ffmpeg 合成 assets/video/buct-ticket.mp4
  python3 tools/render.py 1.0 3.0 5.9     # 只截这几个时间点（秒），输出到 frames/t*.png

依赖： pip install playwright && playwright install chromium ；合成视频需要 ffmpeg。
环境变量 TICKET_URL 可改页面地址（默认 http://localhost:5173/）。
"""
import asyncio, os, subprocess, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get('TICKET_URL', 'http://localhost:5173/').rstrip('/') + '/?render'
OUT = ROOT / 'frames'
times = [float(x) for x in sys.argv[1:]]


async def main():
    async with async_playwright() as p:
        kw = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
        b = await p.chromium.launch(args=['--force-device-scale-factor=1'], **kw)
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        pg.on('pageerror', lambda e: print('pageerror:', e))
        await pg.goto(URL)
        await pg.evaluate('window.ready')
        await pg.wait_for_timeout(300)
        OUT.mkdir(exist_ok=True)
        if times:
            for t in times:
                await pg.evaluate(f'renderAt({t})')
                await pg.screenshot(path=str(OUT / f't{t:.2f}.png'))
        else:
            n = int(await pg.evaluate('DURATION*FPS'))
            for i in range(n):
                await pg.evaluate(f'renderAt({i}/FPS)')
                await pg.screenshot(path=str(OUT / f'f{i:04d}.png'))
            print('frames', n)
        await b.close()


asyncio.run(main())
if not times:
    mp4 = ROOT / 'assets' / 'video' / 'buct-ticket.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', str(OUT / 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow',
                    '-movflags', '+faststart', str(mp4)], check=True)
    print('wrote', mp4)
