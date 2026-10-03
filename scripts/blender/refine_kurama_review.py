import bpy, bmesh, math
from mathutils import Vector
from math import sin, cos, pi
s=bpy.data.scenes['Kurama_Chibi_Review'];bpy.context.window.scene=s
col=bpy.data.collections['Kurama_Chibi_Review']
root=bpy.data.objects['Kurama_Master'];head=bpy.data.objects['Kurama_HeadPivot'];left=bpy.data.objects['Kurama_LeftPawPivot'];right=bpy.data.objects['Kurama_RightPawPivot']
body=bpy.data.objects['Kurama_Coherent_Torso_Hips_Ankles']
M={key:bpy.data.materials['Kurama_'+key] for key in ('Gold','Light','Orange','Ink','Eye','Ivory','Tongue')}
def B(p):return (p[0],-p[2],p[1])
def rayz(o,x,y):
    hit,p,n,index=o.ray_cast(Vector(B((x,y,70))),Vector(B((0,0,-1))))
    if not hit:raise ValueError('Surface patch leaves '+o.name+' at '+str((x,y)))
    return -p.y
def mesh(name,v,f,key,parent):
    d=bpy.data.meshes.new(name);d.from_pydata([B(p) for p in v],[],f);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent;o['shade']=key;o['part']='Head' if parent==head else 'LeftPaw' if parent==left else 'RightPaw' if parent==right else 'Body';d.materials.append(M[key])
    for p in d.polygons:p.use_smooth=True
    return o
def strip(name,points,width,key,parent,base):
    v=[];f=[]
    for j,p in enumerate(points):
        a=Vector(points[max(0,j-1)]);b=Vector(points[min(len(points)-1,j+1)]);d=(b-a).normalized()
        for sign in (-1,1):
            x=p[0]-d.y*width*sign;y=p[1]+d.x*width*sign;v.append((x,y,rayz(base,x,y)+.055))
    for j in range(len(points)-1):f.append((2*j,2*j+1,2*j+3,2*j+2))
    return mesh(name,v,f,key,parent)
remove_prefixes=('Curved_Chest','Hip_Limb_Stripe','Arm_Stripe','Wrist_Chakra_Band','Determined_Upper_Lid','Angled_Eye_Socket','Golden_Eye','Fox_Slit_Pupil','Restrained_Eye_Glint','Orange_Inner_Ear')
for o in list(col.objects):
    if any(o.name.startswith(p) for p in remove_prefixes):bpy.data.objects.remove(o,do_unlink=True)
chest=[(-2.6,12.65),(-2.45,12.25),(-2.15,11.8),(-1.6,11.30),(-.8,11.0),(0,10.9),(.8,11.0),(1.6,11.30),(2.15,11.8),(2.45,12.25),(2.6,12.65)]
strip('Curved_Chest_Marking_Clean',chest,.16,'Ink',root,body)
for side in (-1,1):
    strip('Hip_Limb_Stripe_Clean',[(side*1.1,8.4),(side*1.8,8.05),(side*2.6,7.7),(side*3.3,7.25),(side*4.05,6.7),(side*4.7,6.15)],.12,'Ink',root,body)
for parent,side in ((left,-1),(right,1)):
    arm=next(o for o in col.objects if o.parent==parent and 'Continuous_Sculpt' in o.name)
    strip('Arm_Stripe_Clean',[(side*1.35,-1.1),(side*1.9,-1.65),(side*2.5,-2.3),(side*3.1,-2.95),(side*3.4,-3.4)],.10,'Ink',parent,arm)
    strip('Wrist_Chakra_Band_Clean',[(side*3.07,-3.6),(side*3.4,-3.67),(side*3.8,-3.8),(side*4.15,-3.95)],.14,'Ink',parent,arm)
skull=bpy.data.objects['Kurama_Fox_Forehead_Muzzle']
def eye_patch(name,side,cx,cy,rx,ry,key,offset):
    # Dense concentric rings follow the muzzle curvature; no planar face plate.
    n=32;rows=5;v=[(side*cx,cy,rayz(skull,side*cx,cy)+offset)];f=[]
    for j in range(1,rows+1):
        r=j/rows
        for i in range(n):
            a=2*pi*i/n;dx=rx*cos(a)*r;y=cy+ry*sin(a)*r+.22*dx
            x=side*(cx+dx);v.append((x,y,rayz(skull,x,y)+offset+.018*(1-r*r)))
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for j in range(rows-1):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,head)
for side in (-1,1):
    eye_patch('Angled_Eye_Socket_Embedded',side,1.78,.77,.78,.31,'Ink',.10)
    eye_patch('Golden_Almond_Eye',side,1.78,.78,.63,.21,'Eye',.16)
    eye_patch('Fox_Slit_Pupil',side,1.65,.76,.10,.175,'Ink',.215)
    eye_patch('Eye_Glint',side,1.60,.82,.034,.033,'Ivory',.25)
    # Soft brow follows top lid without crossing its iris.
    strip('Upper_Eyelid',[(side*1.05,.99),(side*1.38,1.10),(side*1.78,1.19),(side*2.18,1.26),(side*2.46,1.22)],.06,'Gold',head,skull)
head.scale=(1.12,1.10,1.12)
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review'
s.render.filepath=OUT+'/renders/front.png';bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kurama-chibi-master.blend')
