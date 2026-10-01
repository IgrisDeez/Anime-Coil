"""Reference-specific editable meshes, executed in live Blender through MCP.
Authoring coordinates match the game (Y up, +Z forward); B converts to Blender.
"""
import bpy, math, json, os
from mathutils import Vector
from math import sin, cos, pi
BASE = r'C:\Users\denze\Documents\Codex\2026-09-23\i-want-x20\outputs\anime-coil'
OUT = os.path.join(BASE, 'assets', 'kitsu')
os.makedirs(OUT, exist_ok=True)
original_scene = bpy.context.scene
scene = bpy.data.scenes.new('Kitsu_Reference_Studio_169')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Kitsu_169_Editable_Master')
scene.collection.children.link(collection)
def B(v): return (v[0], -v[2], v[1])
def material(name, color, rough=.55, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs[0].default_value=(*color,1);n.inputs[1].default_value=metallic;n.inputs[2].default_value=rough
    return m
M={
 'Skin':material('Kitsu_Skin',(0.94,.48,.28)),
 'Hair':material('Kitsu_Hair',(1,.64,.12),.48),
 'Fabric':material('Kitsu_Fabric',(.025,.03,.052),.8),
 'Metal':material('Kitsu_Metal',(.52,.56,.66),.38,.55),
 'Details':material('Kitsu_Details',(.12,.13,.18)),
 'CheekMarks':material('Kitsu_CheekMarks',(.76,.15,.085)),
 'Mouth':material('Kitsu_Mouth',(.34,.07,.035)),
 'EyeWhites':material('Kitsu_EyeWhites',(.95,.90,.88),.4),
 'Pupils':material('Kitsu_Pupils',(.012,.009,.018),.32),
 'Highlights':material('Kitsu_Highlights',(1,.98,.95),.32),
}
def empty(name, pos=(0,0,0), parent=None):
 o=bpy.data.objects.new(name,None);collection.objects.link(o);o.location=B(pos);o.parent=parent;return o
root=empty('KitsuHead'); root['assetVersion']='1.6.9'; root['front']='+Z in glTF';root['attachment']='origin; existing coil retained in game'
eyes=empty('EyesPivot',(0,1.28,0),root);eyes['previewEye']=True
def mesh(name,verts,faces,key,parent=root,smooth=True):
 d=bpy.data.meshes.new(name);d.from_pydata([B(v) for v in verts],[],faces);d.update()
 o=bpy.data.objects.new(name,d);collection.objects.link(o);o.parent=parent
 if parent==eyes:o.location=B((0,-1.28,0))
 d.materials.append(M[key]);o['batch']=key
 if key in ('Hair','Fabric'):o['silhouette']=True
 for p in d.polygons:p.use_smooth=smooth
 return o
def ellipsoid(name,p,s,key,n=24,r=14,parent=root,chin=False):
 v=[];f=[]
 for j in range(r+1):
  t=pi*j/r;h=cos(t);width=1-.15*max(0,-h) if chin else 1
  for i in range(n):
   a=2*pi*i/n;v.append((p[0]+s[0]*sin(t)*cos(a)*width,p[1]+s[1]*h,p[2]+s[2]*sin(t)*sin(a)))
 for j in range(r):
  for i in range(n): a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 return mesh(name,v,f,key,parent)
def tube(name,points,radius,key,n=8):
 v=[];f=[]
 for j,p in enumerate(points):
  tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
  tangent.normalize();u=tangent.cross(Vector((0,0,1))).normalized();w=tangent.cross(u).normalized()
  for i in range(n):v.append(tuple(Vector(p)+radius*(cos(2*pi*i/n)*u+sin(2*pi*i/n)*w)))
 for j in range(len(points)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 f.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))])
 return mesh(name,v,f,key)
def clump(name,base,tip,width,depth,bend=(0,0,0)):
 # Swept leaf cross-sections, broad embedded root, convex ridge, asymmetric taper.
 v=[];f=[];axis=(Vector(tip)-Vector(base));u=axis.cross(Vector((0,0,1)))
 if u.length<.1:u=axis.cross(Vector((0,1,0)))
 u.normalize();w=axis.normalized().cross(u).normalized()
 for j,t in enumerate((0,.28,.58,.82,.98)):
  c=Vector(base)+axis*t+Vector(bend)*sin(pi*t)
  taper=(.72,1,.76,.40,.025)[j]
  for i in range(8):
   a=i*pi/4;v.append(tuple(c+u*cos(a)*width*taper+w*sin(a)*depth*taper))
 for j in range(4):
  for i in range(8):a=j*8+i;b=j*8+(i+1)%8;f.append((a,b,b+8,a+8))
 f.extend([tuple(reversed(range(8))),tuple(32+i for i in range(8))])
 return mesh(name,v,f,'Hair',smooth=False)
ellipsoid('Face_SoftCheeks_TaperedChin',(0,1.09,0),(1.02,.79,.79),'Skin',32,20,chin=True)
ellipsoid('Hair_Underlayer',(0,1.92,-.15),(1.04,.48,.83),'Hair',24,12)
# Recessed bowl ears: a raised perimeter curls around a depressed inner concha.
for side in (-1,1):
 v=[];f=[];n=24
 for radius,z in ((0,.08),(.42,.095),(.64,.21),(.86,.23),(1,.14)):
  for i in range(n):
   a=2*pi*i/n;v.append((side*(1.015+.255*radius*cos(a)),1.07+.30*radius*sin(a),z))
 for j in range(4):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 mesh('Ear_Recess_'+str(side),v,f,'Skin')
 ellipsoid('Eye_OvalWhite_'+str(side),(side*.39,1.28,.697),(.294,.352,.115),'EyeWhites',24,14,eyes)
 ellipsoid('Eye_DarkPupil_'+str(side),(side*.39,1.255,.807),(.18,.25,.059),'Pupils',24,14,eyes)
 ellipsoid('Eye_SculptedHighlight_'+str(side),(side*.35,1.36,.866),(.053,.065,.022),'Highlights',12,8,eyes)
 for j in range(2):
  tube('Raised_CheekMark_'+str(side)+'_'+str(j),[(side*.66,.99-j*.125,.63),(side*.77,.99-j*.125,.58),(side*.83,.99-j*.125,.53)],.035,'CheekMarks')
 clump('Temple_Lock_'+str(side),(side*.93,1.90,.03),(side*.96,1.12,.07),.11,.08)
ellipsoid('Nose_Rounded',(0,1.04,.79),(.113,.115,.115),'Skin',20,12)
tube('Smile_Curved',[(.145*cos(pi*t/12),.805-.047*sin(pi*t/12),.741+.024*sin(pi*t/12)) for t in range(13)],.015,'Mouth',8)
# Closed fitted cloth ribbon, shaped across the dome and rear skull.
v=[];f=[];n=64
for j in range(4):
 for i in range(n):
  a=2*pi*i/n;ry=(1.045,1.055,1.055,1.045)[j];y=(1.62,1.66,1.90,1.935)[j]
  v.append((ry*sin(a),y+.035*(1-cos(a)),.84*cos(a)-.02))
for j in range(3):
 for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
mesh('Headband_FittedWrap',v,f,'Fabric')
# Rounded rectangular silver plate, bevelled perimeter constructed directly.
def plate(name,c,w,h,d,key,angle=0):
 v=[];f=[];n=32
 for z,k in ((-d/2,.95),(d/2,.95),(d/2-.018,1),(-d/2+.018,1)):
  for i in range(n):
   a=2*pi*i/n;xx=w/2*math.copysign(abs(cos(a))**.35,cos(a))*k;yy=h/2*math.copysign(abs(sin(a))**.35,sin(a))*k
   v.append((c[0]+xx*cos(angle)-yy*sin(angle),c[1]+xx*sin(angle)+yy*cos(angle),c[2]+z))
 for j in range(4):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;k=(j+1)%4*n;f.append((a,b,k+(i+1)%n,k+i))
 f.extend([tuple(reversed(range(n))),tuple(n+i for i in range(n))]);return mesh(name,v,f,key)
plate('Silver_RoundedPlate',(0,1.785,.842),.91,.295,.075,'Metal')
plate('Diagonal_Emblem',(0,1.785,.885),.34,.082,.012,'Details',.60)
for x in (-.39,.39):
 for y in (1.69,1.88):ellipsoid('Plate_Rivet',(x,y,.89),(.026,.026,.012),'Metal',10,6)
# Individually directed crown and swept silhouette tiers (no repeated cones).
clump('Crown_HighLeft',(-.70,2.03,-.1),(-.96,2.97,-.04),.30,.22,(.05,0,.05))
clump('Crown_HighRight',(.67,2.04,-.09),(.98,2.98,-.14),.29,.21,(-.05,0,0))
clump('Crown_CentralSweep',(-.34,2.12,-.35),(.44,2.92,-.37),.43,.24,(0,.1,0))
clump('Crown_BackPeak',(.0,2.02,-.64),(-.29,2.90,-.72),.36,.23)
clump('Crown_CrossSweep',(.25,2.13,-.1),(.72,2.73,.0),.39,.22)
for side in (-1,1):
 for j,(y,z,tx,ty,tz,w) in enumerate(((2.12,.04,1.35,2.48,.06,.25),(2.0,.03,1.43,2.17,.12,.24),(1.97,-.27,1.28,1.79,-.18,.23),(2.06,-.48,1.30,2.38,-.69,.30),(1.90,-.58,1.27,1.91,-.86,.24))):
  clump('Swept_Side_'+str(side)+'_'+str(j),(side*.80,y,z),(side*tx,ty,tz),w,.20,(0,.07,0))
 clump('Front_TemplePoint_'+str(side),(side*.85,2.29,.45),(side*.91,1.85,.51),.22,.19)
 clump('Front_SweptLock_'+str(side),(side*.10,2.08,.62),(side*.71,2.43,.64),.31,.16,(0,.035,.03))
clump('Front_CenterDiamond',(0,2.08,.62),(0,2.49,.69),.20,.12)
for j,x in enumerate((-.70,-.37,0,.38,.72)):
 clump('Rear_CrownLock_'+str(j),(x,2.15,-.64),(x+.14,1.87,-.95),.26,.16)
 clump('Rear_NapeLock_'+str(j),(x,1.41,-.56),(x+.12,.69,-.58),.25,.19)
ellipsoid('Rear_Knot',(0,1.64,-.91),(.14,.16,.11),'Fabric',16,10)
for side in (-1,1):
 # Ribbons twist away from the knot; wide square ends, finished thickness.
 points=[(side*.035,1.62,-.96),(side*.13,1.32,-1.01),(side*.22,.97,-1.055),(side*.29,.69,-1.04)]
 v=[];f=[]
 for j,p in enumerate(points):
  width=(.065,.11,.14,.145)[j]
  for dx,dz in ((-width,-.025),(width,-.025),(width,.025),(-width,.025)):
   v.append((p[0]+dx,p[1],p[2]+dz))
 for j in range(3):
  for i in range(4):a=j*4+i;b=j*4+(i+1)%4;f.append((a,b,b+4,a+4))
 f.extend([(3,2,1,0),(12,13,14,15)]);mesh('Rear_FabricTie_'+str(side),v,f,'Fabric')
scene.world=bpy.data.worlds.new('Kitsu_StudioWorld');scene.world.color=(.65,.65,.65)
studio=bpy.data.collections.new('Kitsu_Studio_Lighting');scene.collection.children.link(studio)
def aim(o,p):o.rotation_euler=(Vector(B(p))-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,5,5),650,4),('Fill',(4,3,3),450,3),('Rim',(1,4,-4),700,3)]:
 d=bpy.data.lights.new('Studio_'+name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);aim(o,(0,1.5,0))
d=bpy.data.cameras.new('Kitsu_StudioCamera');cam=bpy.data.objects.new(d.name,d);studio.objects.link(cam);cam.location=B((0,1.6,7));aim(cam,(0,1.6,0));d.type='ORTHO';d.ortho_scale=3.55;scene.camera=cam
scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.engine=original_scene.render.engine
# Save the dedicated asset without overwriting the original scene's file.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'kitsu-head-master.blend'))
print(json.dumps({'scene':scene.name,'collection':collection.name,'meshes':len([o for o in collection.objects if o.type=='MESH']),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in collection.objects if o.type=='MESH')}))
