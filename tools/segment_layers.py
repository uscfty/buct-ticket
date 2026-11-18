"""把校园插画 assets/images/campus-illustration.jpg 拆成可单独做动画的图层。

输出 assets/layers/<图层名>.png 和 assets/layers/meta.json（页面直接引用）；
调试用的中间图写到 frames/（已被 .gitignore 忽略）。
在项目根目录运行： python3 tools/segment_layers.py
依赖： pip install pillow numpy scipy
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as ndi
import json, os
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.chdir(ROOT)
LAYERS='assets/layers'; DEBUG='frames'
os.makedirs(LAYERS,exist_ok=True); os.makedirs(DEBUG,exist_ok=True)

SRC='assets/images/campus-illustration.jpg'
im=Image.open(SRC).convert('RGB')
W,H=im.size
CROP_H=592
a=np.array(im).astype(np.int32)[:CROP_H]
H=CROP_H
r,g,b=a[...,0],a[...,1],a[...,2]

# background: vertical gradient estimated from left/right border columns
bgcol=np.median(np.concatenate([a[:,:6],a[:,-6:]],axis=1),axis=1)  # H x 3
bgcol=ndi.uniform_filter1d(bgcol,31,axis=0)
diff=np.abs(a-bgcol[:,None,:]).max(-1)
cand=diff<9
lab,n=ndi.label(cand)
border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
# bottom row touches the pond: only accept bg from top/left/right borders + bottom outside pond
bg=np.isin(lab,list(border))
bg=ndi.binary_opening(bg,iterations=1)|(bg&(ndi.uniform_filter(bg.astype(float),5)>0.9))
alpha=np.where(bg,0,255).astype(np.uint8)
# soft edge
alpha=np.minimum(alpha,np.clip((diff-6)*40,0,255)).astype(np.uint8) if False else alpha
soft=ndi.gaussian_filter(alpha.astype(float),0.7)
alpha=np.where(alpha>0,np.maximum(soft,160),0).astype(np.uint8)
alpha=np.where(ndi.binary_erosion(alpha>0,iterations=1),255,alpha)
fg=alpha>0
_l,_n=ndi.label(fg)
_sz=ndi.sum(fg,_l,range(1,_n+1))
_small=np.isin(_l,[k+1 for k,v in enumerate(_sz) if v<60])
alpha[_small]=0
fg=alpha>0

def poly(pts):
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(pts,fill=255); return np.array(m)>0
def rect(x0,y0,x1,y1):
    m=np.zeros((H,W),bool); m[y0:y1,x0:x1]=True; return m
def circ(cx,cy,rad):
    yy,xx=np.mgrid[:H,:W]; return (xx-cx)**2+(yy-cy)**2<=rad*rad
def clean(m,d=2,fill=True):
    m=ndi.binary_closing(m,iterations=2)
    if fill: m=ndi.binary_fill_holes(m)
    if d: m=ndi.binary_dilation(m,iterations=d)
    return m
def near(c,t):
    return (np.abs(a-np.array(c)).max(-1)<t)

green=(g>r+8)&(g>b+25)
yellow=(r>215)&(g>185)&(b<150)
pinkc=near((254,171,179),26)
whitish=(a.min(-1)>205)
mount=near((119,163,188),26)|near((166,211,211),18)

L=[]  # (name, mask) front -> back
stone=poly([(536,592),(536,548),(552,520),(585,502),(612,496),(616,486),(748,486),(752,498),(785,512),(800,545),(806,592)])
statue=poly([(650,350),(700,350),(722,372),(735,420),(742,490),(636,490),(632,420),(640,372)])
statue=clean(statue&(b<135)&(r>110),1,fill=True)&statue
L.append(('statue',stone|statue))
plantreg=poly([(183,380),(272,380),(272,402),(330,398),(334,462),(288,468),(288,488),(410,492),(410,592),(183,592)])|poly([(410,535),(500,535),(500,572),(410,572)])
L.append(('plants',clean(green&plantreg,2)&(plantreg|True)))
bushreg=rect(860,512,1150,592)
L.append(('bush',clean((green|(near((182,207,51),45)))&bushreg,2)))
L.append(('bridge',poly([(722,497),(760,480),(800,468),(850,458),(885,455),(930,464),(980,483),(1030,508),(1060,526),(1102,540),(1102,566),(1040,562),(1000,550),(960,522),(900,507),(850,505),(800,514),(760,527),(722,537)])))
L.append(('cherry',poly([(1016,384),(1028,356),(1050,343),(1076,346),(1100,370),(1100,402),(1086,422),(1070,428),(1070,450),(1054,450),(1054,428),(1034,428),(1018,412)])))
L.append(('library',poly([(783,400),(1000,351),(1006,358),(1040,408),(1076,433),(1174,430),(1176,524),(1090,524),(1000,510),(880,462),(840,468),(783,504)])))
L.append(('dove',poly([(788,328),(804,316),(834,323),(842,285),(860,290),(864,318),(870,335),(870,350),(854,360),(838,347),(804,352)])))
L.append(('flask',poly([(683,183),(748,188),(748,242),(698,242)])&~yellow))
L.append(('bubbles',circ(642,236,21)|circ(598,249,12)|circ(665,263,10)))
L.append(('pinkbldg',poly([(452,395),(529,395),(529,365),(857,365),(857,402),(792,414),(792,447),(700,464),(438,464),(438,442),(452,430)])))
L.append(('redbldg',poly([(28,348),(38,336),(72,326),(394,326),(394,338),(480,338),(480,328),(536,330),(536,394),(455,394),(455,440),(440,449),(28,449)])))
L.append(('pond',poly([(108,436),(1112,436),(1112,592),(183,592),(183,502),(108,502)])))
catreg=poly([(340,302),(342,272),(362,264),(366,234),(388,230),(402,242),(440,244),(452,256),(456,270),(446,292),(444,302)])
L.append(('cat',clean(catreg&~pinkc&~yellow,1)&catreg))
L.append(('skybridge',poly([(476,258),(506,258),(522,280),(684,280),(684,352),(653,352),(653,324),(522,324),(522,342),(476,342)])))
L.append(('mountain',clean(mount&rect(520,280,1112,470),1,fill=False)))
L.append(('bluebldg',poly([(876,276),(958,246),(960,230),(1027,190),(1107,236),(1107,252),(1098,256),(1110,338),(876,338)])))
cl=rect(108,192,484,334)
L.append(('cloudL',clean(whitish&cl,2,fill=True)&cl))
cr=rect(660,128,1110,462)
L.append(('cloudR',clean(whitish&cr,2,fill=False)&cr))
L.append(('beam',clean(yellow&rect(500,140,705,360),1,fill=False)))
L.append(('sun',clean(yellow&rect(40,15,345,300),1)))
L.append(('pinkcircle',clean(pinkc&rect(90,0,525,325),1,fill=False)))

names=[n for n,_ in L]
label=np.zeros((H,W),np.int32)
for i,(n,m) in enumerate(L,1):
    label[(label==0)&m&fg]=i
# leftovers -> nearest label
left=fg&(label==0)
idx=ndi.distance_transform_edt(label==0,return_distances=False,return_indices=True)
label[left]=label[idx[0][left],idx[1][left]]
# remove tiny fragments per label: reassign components < 25px to neighbouring majority label
for it in range(2):
    for i in range(1,len(names)+1):
        cl_,n=ndi.label(label==i)
        if n<=1: continue
        sizes=ndi.sum(np.ones_like(cl_),cl_,range(1,n+1))
        small=np.isin(cl_,[k+1 for k,s in enumerate(sizes) if s<40])
        if small.any():
            tmp=label.copy(); tmp[small]=0
            idx=ndi.distance_transform_edt((tmp==0),return_distances=False,return_indices=True)
            cand=tmp[idx[0],idx[1]]
            label[small]=cand[small]
label[~fg]=0

S=0.95
FLOAT=['dove','bubbles','cat','flask']
fid=[names.index(n)+1 for n in FLOAT]
Fm=np.isin(label,fid)
Fd=ndi.binary_dilation(Fm,iterations=5)
idx=ndi.distance_transform_edt(Fd,return_distances=False,return_indices=True)
base_rgb=a.copy(); base_label=label.copy(); base_alpha=alpha.copy()
src_lab=np.where(np.isin(label,fid),0,label)
base_rgb[Fm]=a[idx[0][Fm],idx[1][Fm]]
base_label[Fm]=src_lab[idx[0][Fm],idx[1][Fm]]
base_alpha[Fm]=np.where(base_label[Fm]>0,255,0)
# smooth the filled area a little
Fm2=ndi.binary_dilation(Fm,iterations=4)&(base_alpha>0)
base_rgb[Fm2&~Fm]=a[idx[0][Fm2&~Fm],idx[1][Fm2&~Fm]]
ci=names.index('cat')+1; pi=names.index('pinkcircle')+1; cli=names.index('cloudL')+1
catm=ndi.binary_dilation(label==ci,iterations=4)&((label==ci)|(label==pi)|(label==cli))
pc=np.where(np.isin(label,[pi,cli])&~ndi.binary_dilation(label==ci,iterations=6),label,0)
ix=ndi.distance_transform_edt(pc==0,return_distances=False,return_indices=True)
nl=pc[ix[0],ix[1]]
cm=(label==ci)|(catm&(label==pi))
base_label[cm]=nl[cm]; base_alpha[cm]=255
base_rgb[cm&(nl==pi)]=(254,171,179); base_rgb[cm&(nl==cli)]=(255,255,255)
sm=np.dstack([ndi.gaussian_filter(base_rgb[...,c].astype(float),1.5) for c in range(3)])
base_rgb[Fm2]=sm[Fm2]
NW,NH=round(W*S),round(H*S)
def scaled(rgb,al):
    return np.array(Image.fromarray(np.dstack([rgb.astype(np.uint8),al.astype(np.uint8)]),'RGBA').resize((NW,NH),Image.LANCZOS))
def scaledlab(l):
    return np.array(Image.fromarray(l.astype(np.uint8)).resize((NW,NH),Image.NEAREST))
big_base=scaled(base_rgb,base_alpha); lab_base=scaledlab(base_label)
big_top=scaled(a,alpha); lab_top=scaledlab(label)
Image.fromarray(big_top,'RGBA').save(f'{DEBUG}/_full.png')
Image.fromarray(big_base,'RGBA').save(f'{DEBUG}/_base.png')
meta={'W':NW,'H':NH,'scale':S,'bgTop':bgcol[0].round().tolist(),'bgBottom':bgcol[-1].round().tolist(),'layers':[]}
ZORDER=['pinkcircle','sun','beam','cat','cloudL','cloudR','bluebldg','mountain','skybridge','redbldg','pinkbldg','pond','library','cherry','bridge','bush','plants','statue','bubbles','flask','dove']
zi={n:k for k,n in enumerate(ZORDER)}
zmap=np.full(len(names)+1,-1); 
for k,n in enumerate(names,1): zmap[k]=zi[n]
zpix=zmap[base_label]
from scipy.spatial import ConvexHull
EXT={'pinkcircle':'hull','sun':'hull','beam':'hull','cloudL':(45,None),'cloudR':(60,None),'mountain':(70,None),'pond':(140,['statue','plants','bush','bridge'])}
ext_layers={}
def domcol(px):
    q=(px//8).astype(np.int64); key=q[:,0]*4096+q[:,1]*64+q[:,2]
    u,c=np.unique(key,return_counts=True); k=u[c.argmax()]
    return np.median(px[key==k],axis=0)
for n,mode in EXT.items():
    i=names.index(n)+1
    own=base_label==i
    front=(zpix>zi[n])&(base_alpha>0)
    if mode=='hull':
        ys,xs=np.where(own); pts=np.c_[xs,ys]; h=ConvexHull(pts)
        m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts[h.vertices]],fill=255)
        reg=(np.array(m)>0)&front
        col=np.median(a[ndi.binary_erosion(own,iterations=3)],axis=0)
        e_rgb=base_rgb.copy(); e_rgb[reg]=col
    else:
        r,allow=mode
        if allow: front=front&np.isin(base_label,[names.index(q)+1 for q in allow])
        P=r+4
        op=np.pad(own,P)
        dil=ndi.distance_transform_edt(~op)<=r
        clo=(ndi.distance_transform_edt(dil)>r)[P:-P,P:-P]
        reg=clo&front&~own
        col=domcol(a[ndi.binary_erosion(own,iterations=3)])
        print(n,'ext fill',col,int(reg.sum()))
        e_rgb=base_rgb.copy(); e_rgb[reg]=col
    ext_layers[n]=(scaled(e_rgb,np.where(reg|own,255,0)),scaledlab(reg.astype(np.uint8))>0)
for i,n in enumerate(names,1):
    if n in FLOAT: m=lab_top==i; src=big_top
    else: m=lab_base==i; src=big_base
    if not m.any(): print('EMPTY',n); continue
    full=np.zeros_like(src); full[m]=src[m]
    if n in ext_layers:
        eimg,em=ext_layers[n]; em=em&~m
        full[em]=eimg[em]; full[em,3]=255
        m=m|em
    ys,xs=np.where(m)
    x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    Image.fromarray(full[y0:y1,x0:x1],'RGBA').save(f'{LAYERS}/{n}.png')
    own_m=(lab_top==i) if n in FLOAT else (lab_base==i)
    oy,ox=np.where(own_m)
    meta['layers'].append({'name':n,'x':int(x0),'y':int(y0),'w':int(x1-x0),'h':int(y1-y0),'cx':float(ox.mean()),'cy':float(oy.mean()),'float':n in FLOAT})
    print(n,x0,y0,x1-x0,y1-y0,int(m.sum()))
# verify exact reassembly
comp=np.zeros((NH,NW,4),float)
for n in ZORDER:
    l=[q for q in meta['layers'] if q['name']==n][0]
    im_=np.array(Image.open(f'{LAYERS}/{n}.png')).astype(float)
    reg_=comp[l['y']:l['y']+l['h'],l['x']:l['x']+l['w']]
    al=im_[...,3:4]/255.
    reg_[...,:3]=im_[...,:3]*al+reg_[...,:3]*(1-al); reg_[...,3:4]=al*255+reg_[...,3:4]*(1-al)
ref=big_top.astype(float)
d=np.abs(comp[...,:3]-ref[...,:3]).max(-1)*(ref[...,3]>0)
print('reassembly diff: max',d.max(),'pixels>12:',int((d>12).sum()))
Image.fromarray(comp.astype(np.uint8),'RGBA').save(f'{DEBUG}/_recomp.png')
json.dump(meta,open(f'{LAYERS}/meta.json','w'),indent=1)
# debug viz
rng=np.random.RandomState(3)
pal=np.vstack([[30,30,30],rng.randint(40,255,(len(names),3))]).astype(np.uint8)
viz=pal[label]
viz=(0.6*viz+0.4*a).astype(np.uint8)
Image.fromarray(viz).resize((W*2,H*2),Image.NEAREST).save(f'{DEBUG}/seg_viz.png')
chk=np.array(Image.new('RGB',(W,H),(20,20,60))).astype(float)
al=alpha[...,None]/255.
Image.fromarray((a*al+chk*(1-al)).astype(np.uint8)).save(f'{DEBUG}/alpha_viz.png')
print(meta['bgTop'],meta['bgBottom'])
