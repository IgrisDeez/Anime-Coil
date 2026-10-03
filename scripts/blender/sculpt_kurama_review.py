"""Reference-shaped Kurama review. Execute through the connected Blender MCP.
Game coordinates: Y up, +Z muzzle forward. Default scene and old assets retained.
"""
import bpy, bmesh, math, json
from mathutils import Vector, Quaternion
from math import sin, cos, pi, sqrt
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review'
if bpy.data.scenes.get('Kurama_Chibi_Review'):raise RuntimeError('Use a fresh Blender scene for a new build; the existing editable candidate is preserved.')
s=bpy.data.scenes.new('Kurama_Chibi_Review');bpy.context.window.scene=s
col=bpy.data.collections.new('Kurama_Chibi_Review');s.collection.children.link(col)
studio=bpy.data.collections.new('Kurama_Review_Studio');s.collection.children.link(studio)
def B(p):return (p[0],-p[2],p[1])
def G(p):return (p[0],p[2],-p[1])
def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
PALETTE={'Gold':'#ffc94c','Light':'#ffe176','Orange':'#ef8a28','Ink':'#302431','Eye':'#fff28d','Ivory':'#fff0d0','Tongue':'#a64c58'}
M={}
for key,color in PALETTE.items():
    m=bpy.data.materials.new('Kurama_'+key);m.use_nodes=True
    rgb=tuple(lin(int(color[i:i+2],16)/255) for i in (1,3,5));m.diffuse_color=(*rgb,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs[0].default_value=(*rgb,1);n.inputs[2].default_value=.85;n.inputs[14].default_value=.15
    M[key]=m
def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;o.location=B(pos);return o
root=empty('Kurama_Master');root['reviewStatus']='AWAITING_VISUAL_APPROVAL';root['coordinateSystem']='Y up, +Z forward'
head=empty('Kurama_HeadPivot',(0,14.4,1.1),root)
left=empty('Kurama_LeftPawPivot',(-3.25,12.35,0),root)
right=empty('Kurama_RightPawPivot',(3.25,12.35,0),root)
muzzle=empty('Kurama_Muzzle',(0,-.9,4.75),head)
def mesh(name,vs,fs,key='Gold',parent=None):
    d=bpy.data.meshes.new(name);d.from_pydata([B(p) for p in vs],[],fs);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent or root;o['shade']=key
    d.materials.append(M[key]);o['part']='Head' if parent==head else 'LeftPaw' if parent==left else 'RightPaw' if parent==right else 'Body'
    for f in d.polygons:f.use_smooth=True
    return o
def cm(vals,t):
    f=t*(len(vals)-1);i=min(len(vals)-2,int(f));u=f-i
    a=vals[max(0,i-1)];b=vals[i];c=vals[i+1];d=vals[min(len(vals)-1,i+2)]
    return tuple(.5*((2*b[j])+(-a[j]+c[j])*u+(2*a[j]-5*b[j]+4*c[j]-d[j])*u*u+(-a[j]+3*b[j]-3*c[j]+d[j])*u*u*u) for j in range(len(b)))
def loft(name,sections,key='Gold',parent=None,rows=20,sides=20):
    # Parallel section frames produce authored organic forms, with closed roots.
    v=[];f=[]
    for j in range(rows+1):
        t=j/rows;q=cm(sections,t);p=Vector(q[:3]);before=Vector(cm(sections,max(0,t-.001))[:3]);after=Vector(cm(sections,min(1,t+.001))[:3]);axis=(after-before).normalized()
        seed=Vector((1,0,0)) if abs(axis.x)<.85 else Vector((0,1,0));u=(seed-axis*axis.dot(seed)).normalized();w=axis.cross(u).normalized()
        for i in range(sides):
            a=i*2*pi/sides;point=p+u*(cos(a)*max(.006,q[3]))+w*(sin(a)*max(.006,q[4]));v.append(tuple(point))
    for j in range(rows):
        for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
    v.extend([tuple(sections[0][:3]),tuple(sections[-1][:3])]);b=len(v)-2;e=len(v)-1
    for i in range(sides):f.extend([(b,(i+1)%sides,i),(e,rows*sides+i,rows*sides+(i+1)%sides)])
    return mesh(name,v,f,key,parent)
def merge_organic(name,objects,voxel=.16):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name=name
    r=o.modifiers.new('Continuous anatomical transitions','REMESH');r.mode='VOXEL';r.voxel_size=voxel;r.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=r.name)
    r=o.modifiers.new('Soft joint transitions','SMOOTH');r.factor=.65;r.iterations=3;bpy.ops.object.modifier_apply(modifier=r.name)
    for p in o.data.polygons:p.use_smooth=True
    return o
bodyparts=[loft('Torso',[(0,6.6,-.6,.9,.9),(0,7.6,-.6,2.25,1.6),(0,9.0,-.5,2.55,1.65),(0,11.5,-.35,3.1,1.95),(0,12.7,-.05,3.0,1.9),(0,14,.1,1.65,1.35),(0,15,.3,.8,.8)])]
for side in (-1,1):
    bodyparts += [loft('Hip_Knee_Ankle',[(side*1.65,8.3,-.65,1.45,1.3),(side*3.45,7.3,.9,1.75,1.5),(side*5.0,5.65,1.3,1.3,1.1),(side*4.95,3.45,1.0,.85,.85),(side*5.3,1.15,2.5,.85,.75)],rows=28),
      loft('Grounded_HindPaw',[(side*5.3,.8,1.8,1.0,.5),(side*5.4,.7,3.1,1.3,.65),(side*5.45,.6,4.25,1.2,.45),(side*5.45,.6,4.9,.5,.25)],rows=18)]
    for finger in range(4):
        x=side*5.4+(finger-1.5)*.60
        bodyparts.append(loft('Hind_Toe',[(x,.68,4.0,.36,.3),(x+side*.08,.5,4.85,.35,.28),(x+side*.12,.55,5.3,.18,.18)],rows=10,sides=12))
body=merge_organic('Kurama_Coherent_Torso_Hips_Ankles',bodyparts)
def rayz(o,x,y,fallback=1):
    hit,p,n,index=o.ray_cast(Vector(B((x,y,70))),Vector(B((0,0,-1))))
    return -p.y if hit else fallback
def patch(name,outline,key,parent,base,swell=.018,offset=.025,rows=3):
    cx=sum(p[0] for p in outline)/len(outline);cy=sum(p[1] for p in outline)/len(outline);n=len(outline)
    v=[(cx,cy,rayz(base,cx,cy)+offset+swell)];f=[]
    for j in range(1,rows+1):
        r=j/rows
        for x,y in outline:
            xx=cx+(x-cx)*r;yy=cy+(y-cy)*r;v.append((xx,yy,rayz(base,xx,yy)+offset+swell*(1-r*r)))
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for j in range(rows-1):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,parent)
def oval(name,cx,cy,rx,ry,key,parent,base,offset=.025):
    return patch(name,[(cx+rx*cos(2*pi*i/24),cy+ry*sin(2*pi*i/24)) for i in range(24)],key,parent,base,.025,offset)
def ribbon(name,points,width,key,parent,base):
    outline=[]
    for j,p in enumerate(points):
        a=Vector(points[max(0,j-1)]);b=Vector(points[min(len(points)-1,j+1)]);d=(b-a).normalized();outline.append((p[0]-d.y*width,p[1]+d.x*width))
    for j in reversed(range(len(points))):
        a=Vector(points[max(0,j-1)]);b=Vector(points[min(len(points)-1,j+1)]);d=(b-a).normalized();p=points[j];outline.append((p[0]+d.y*width,p[1]-d.x*width))
    return patch(name,outline,key,parent,base,0,.035,rows=2)
bodyfront=body
chest=[(-2.8,12.8),(-2.6,12.3),(-2.2,11.7),(-1.6,11.15),(-.8,10.85),(0,10.75),(.8,10.85),(1.6,11.15),(2.2,11.7),(2.6,12.3),(2.8,12.8)]
ribbon('Curved_Chest_Marking',chest,.15,'Ink',root,bodyfront)
oval('Abdominal_Gold_Ring',0,8.7,1.05,.95,'Light',root,bodyfront,.035)
oval('Abdominal_Ink_Ring',0,8.7,.88,.79,'Ink',root,bodyfront,.08)
oval('Abdominal_Chakra_Center',0,8.7,.65,.59,'Orange',root,bodyfront,.125)
for side in (-1,1):
    ribbon('Hip_Limb_Stripe',[(side*1.1,8.4),(side*1.8,8.05),(side*2.6,7.7),(side*3.3,7.25),(side*4.05,6.7),(side*4.7,6.15)],.12,'Ink',root,bodyfront)
    for finger in range(4):
        x=side*5.4+(finger-1.5)*.60
        loft('Hind_Claw',[(x+side*.12,.55,5.15,.20,.18),(x+side*.15,.58,5.55,.13,.11),(x+side*.18,.58,5.85,.006,.006)],'Orange',rows=6,sides=8)
for parent,side in ((left,-1),(right,1)):
    pieces=[loft('Shoulder_Elbow_Wrist',[(0,.1,0,1.4,1.25),(side*1.0,-1.05,.15,1.4,1.25),(side*2.3,-2.25,.8,1.08,.95),(side*3.35,-3.4,1.75,.77,.72),(side*3.8,-4.15,2.75,.85,.65)],parent=parent,rows=25),
      loft('Broad_ForePaw',[(side*3.7,-4.2,2.0,.8,.6),(side*4.15,-4.3,3.0,1.15,.62),(side*4.25,-4.35,3.7,1.20,.47),(side*4.25,-4.4,4.4,.6,.20)],parent=parent)]
    for finger in range(4):
        x=side*4.25+(finger-1.5)*.54
        pieces.append(loft('Fore_Finger',[(x,-4.35,3.5,.35,.28),(x+side*.05,-4.55,4.35,.30,.25),(x+side*.11,-4.5,4.85,.13,.13)],parent=parent,rows=10,sides=12))
    pieces.append(loft('Fore_Thumb',[(side*3.15,-4.2,3,.4,.3),(side*2.75,-4.55,3.65,.32,.28),(side*2.8,-4.55,4.25,.12,.13)],parent=parent,rows=12,sides=12))
    arm=merge_organic('Kurama_'+parent.name+'_Continuous_Sculpt',pieces,.14)
    front=arm
    oval('Shoulder_Chakra_Rim',side*.55,-.32,1.0,.92,'Orange',parent,front,.04)
    oval('Shoulder_Circle',side*.55,-.32,.79,.73,'Ink',parent,front,.09)
    oval('Shoulder_Gold_Center',side*.55,-.32,.58,.53,'Gold',parent,front,.14)
    ribbon('Arm_Stripe',[(side*1.35,-1.1),(side*1.9,-1.65),(side*2.5,-2.3),(side*3.1,-2.95),(side*3.4,-3.4)],.10,'Ink',parent,front)
    ribbon('Wrist_Chakra_Band',[(side*3.07,-3.6),(side*3.4,-3.67),(side*3.8,-3.8),(side*4.15,-3.95)],.14,'Ink',parent,front)
    for finger in range(4):
        x=side*4.25+(finger-1.5)*.54
        loft('Fore_Claw',[(x+side*.11,-4.5,4.7,.19,.16),(x+side*.15,-4.48,5.0,.12,.10),(x+side*.2,-4.48,5.3,.006,.006)],'Orange',parent,rows=6,sides=8)
# Head shaped along the muzzle axis; tapering snout and pitched lower jaw.
skull=loft('Kurama_Fox_Forehead_Muzzle',[(0,.2,-2.45,.75,.75),(0,.35,-1.75,2.4,1.65),(0,.4,-.5,3.15,2.02),(0,.35,.8,2.95,1.72),(0,.08,1.95,2.03,.99),(0,-.22,3.0,1.2,.50),(0,-.22,4.2,1.02,.38),(0,-.25,4.55,.55,.22)],'Gold',head,rows=34,sides=28)
jaw=loft('Kurama_Open_Lower_Jaw',[(0,-1.15,.3,1.35,.35),(0,-1.9,1.85,1.25,.38),(0,-2.15,3.25,1.04,.28),(0,-1.96,4.32,.84,.22),(0,-1.92,4.52,.5,.1)],'Light',head,rows=20,sides=20)
loft('Kurama_Mouth_Cavity',[(0,-1.02,1.25,1.25,.4),(0,-1.13,2.8,1.08,.72),(0,-1.10,3.95,.85,.65),(0,-1.12,4.3,.74,.56)],'Ink',head,rows=15,sides=18)
loft('Kurama_Tongue',[(0,-1.78,2.5,.28,.06),(0,-1.8,3.4,.47,.12),(0,-1.78,4.15,.3,.05)],'Tongue',head,rows=12,sides=12)
loft('Kurama_Small_Dark_Nose',[(0,-.12,4.4,.42,.24),(0,-.14,4.66,.49,.24),(0,-.28,4.84,.22,.17),(0,-.32,4.87,.05,.08)],'Ink',head,rows=10,sides=14)
front=skull
for side in (-1,1):
    ear=loft('Swept_Fox_Ear',[(side*2.05,1.2,-.6,.95,.60),(side*2.85,2.30,-.85,.8,.39),(side*3.65,3.20,-1.02,.55,.26),(side*4.35,4.1,-1.4,.006,.006)],'Gold',head,rows=18,sides=12)
    # A thin fitted inner-ear fold, not a second intersecting ear volume.
    earfront=ear
    patch('Orange_Inner_Ear',[(side*2.43,1.75),(side*3.13,2.92),(side*4.02,3.74),(side*3.36,2.10)],'Orange',head,earfront,.018,.022)
    for i in range(3):
        loft('Directional_Cheek_Tuft',[(side*2.4,-.1-i*.5,-.35,.5,.4),(side*3.4,-.15-i*.55,-.85,.48,.25),(side*(3.65-i*.2),-.35-i*.65,-1.85,.006,.006)],'Orange',head,rows=10,sides=10)
    outline=[(side*.98,.62),(side*1.50,.94),(side*2.43,1.06),(side*2.65,.79),(side*2.28,.42),(side*1.52,.32)]
    patch('Angled_Eye_Socket',outline,'Ink',head,front,.03,.035)
    patch('Golden_Eye',[(side*1.25,.6),(side*1.65,.8),(side*2.28,.88),(side*2.40,.75),(side*2.08,.53),(side*1.58,.47)],'Eye',head,front,.03,.095)
    oval('Fox_Slit_Pupil',side*1.75,.65,.105,.19,'Ink',head,front,.17)
    oval('Restrained_Eye_Glint',side*1.69,.73,.055,.049,'Ivory',head,front,.205)
    ribbon('Determined_Upper_Lid',[(side*.92,.73),(side*1.46,1.00),(side*2.10,1.18),(side*2.75,1.20)],.13,'Light',head,front)
    for i in range(3):
        patch('Three_Dark_Cheek_Marks',[(side*2.12,.17-i*.4),(side*2.68,.05-i*.41),(side*2.83,-.24-i*.41),(side*2.13,-.02-i*.4)],'Ink',head,front,0,.04,rows=2)
    # Two larger fangs and only a few small incisors give a legible chibi roar.
    loft('Upper_Fang',[(side*.92,-.58,3.25,.21,.20),(side*.95,-1.12,3.45,.16,.15),(side*.82,-1.69,3.59,.006,.006)],'Ivory',head,rows=7,sides=8)
    loft('Lower_Fang',[(side*.77,-1.94,3.70,.17,.16),(side*.8,-1.63,3.86,.10,.1),(side*.68,-1.35,3.91,.006,.006)],'Ivory',head,rows=6,sides=8)
for i in range(4):
    x=(i-1.5)*.4
    loft('Small_Incisor',[(x,-.57,4.23,.13,.12),(x,-.88,4.32,.07,.07),(x,-.99,4.33,.006,.006)],'Ivory',head,rows=4,sides=6)
# Tail prototype and nine linked, individually arranged master instances.
def tailmesh(name,rows=22,sides=14):
    v=[];f=[]
    for j in range(rows+1):
        t=j/rows;r=(.09+.32*sin(pi*t**.75))*(1-t)**.42+.003
        cx=.23*sin(t*pi*1.8);cy=.16*sin(t*pi)+.34*t*t
        for i in range(sides):
            a=2*pi*i/sides;v.append((cx+cos(a)*r,cy+sin(a)*r*.72,t*2.5))
    for j in range(rows):
        for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
    f.extend([tuple(reversed(range(sides))),tuple(rows*sides+i for i in range(sides))])
    o=mesh(name,v,f);o['part']='Tail';o.data.materials.append(M['Orange']);o.data.materials.append(M['Ink'])
    for j in range(rows):
        for i in range(sides):
            o.data.polygons[j*sides+i].material_index=2 if 9<=i<=10 and .07<j/rows<.91 else 1 if j/rows>.68 or i<3 else 0
    return o
tailscol=bpy.data.collections.new('Kurama_Nine_Linked_Tails');s.collection.children.link(tailscol)
prototype=tailmesh('Kurama_Flame_Tail_Prototype');prototype.hide_render=True;prototype.hide_viewport=True
def tailpose(i):
    rank=i-4
    q=Quaternion(Vector((0,0,1)),-rank*.253) @ Quaternion(Vector((1,0,0)),-pi/2-.20) @ Quaternion(Vector((0,1,0)),rank*.052)
    # Blender mapping of game quaternion (x,y,z,w) -> (x,-z,y,w).
    qb=Quaternion((q.w,q.x,-q.z,q.y))
    return B((rank*.34,7.2+abs(rank)*.1,-2.3-(i%2)*.35)),qb,(5.0+abs(rank)*.10,8.6-abs(rank)*.35+(i%2)*.28,5.1-(i%3)*.23)
for i in range(9):
    o=bpy.data.objects.new('Kurama_Tail_%02d'%(i+1),prototype.data);tailscol.objects.link(o);o.parent=root;o['part']='TailInstance';o['tailIndex']=i
    p,q,sc=tailpose(i);o.location=p;o.rotation_mode='QUATERNION';o.rotation_quaternion=q;o.scale=sc
# Neutral studio keeps the asset free from export lights and cameras.
world=bpy.data.worlds.new('Kurama_Neutral_Studio');world.use_nodes=True;s.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.16,.18,.24,1);bg.inputs[1].default_value=.45
def light(name,pos,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=B(pos);o.rotation_euler=(Vector(B((0,12,0)))-o.location).to_track_quat('-Z','Y').to_euler()
light('Kurama_Key',(-18,32,32),13000,18,(1,.87,.70));light('Kurama_Fill',(18,20,20),8000,22,(.74,.84,1));light('Kurama_Rim',(0,25,-20),16000,16,(1,.72,.42))
floor=mesh('Kurama_Studio_Floor',[(-100,-.06,-100),(100,-.06,-100),(100,-.06,100),(-100,-.06,100)],[(0,1,2,3)],'Light')
col.objects.unlink(floor);studio.objects.link(floor);floor.parent=None
fm=bpy.data.materials.new('Kurama_Studio_Matte');fm.use_nodes=True;nd=next(n for n in fm.node_tree.nodes if n.type=='BSDF_PRINCIPLED');nd.inputs[0].default_value=(.12,.14,.19,1);nd.inputs[2].default_value=1;floor.data.materials.clear();floor.data.materials.append(fm)
camd=bpy.data.cameras.new('Kurama_Review_Camera');camd.type='ORTHO';camd.ortho_scale=35
cam=bpy.data.objects.new('Kurama_Review_Camera',camd);studio.objects.link(cam);s.camera=cam
cam.location=B((0,14,65));cam.rotation_euler=(Vector(B((0,14,0)))-cam.location).to_track_quat('-Z','Y').to_euler()
try:s.render.engine='CYCLES'
except TypeError:pass
s.cycles.samples=40;s.cycles.use_denoising=True;s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.film_transparent=False
try:s.view_settings.view_transform='Standard'
except TypeError:pass
s.render.filepath=OUT+'/renders/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=48;area.spaces.active.region_3d.view_location=Vector(B((0,14,0)));area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kurama-chibi-master.blend')
print(json.dumps({'scene':s.name,'meshes':len([o for o in col.objects if o.type=='MESH']),'tails':len(tailscol.objects),'file':OUT+'/kurama-chibi-master.blend'}))
