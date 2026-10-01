import bpy, math
from mathutils import Vector
from math import sin,cos,pi
col=bpy.data.collections['Kitsu_169_Editable_Master'];root=bpy.data.objects['KitsuHead']
def shell(name,p,s,key,n=24,r=14):
 v=[];f=[]
 for j in range(r+1):
  t=pi*j/r
  for i in range(n):
   a=2*pi*i/n;v.append((p[0]+s[0]*sin(t)*cos(a),-(p[2]+s[2]*sin(t)*sin(a)),p[1]+s[1]*cos(t)))
 for j in range(r):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=root;o['batch']=key
 d.materials.append(bpy.data.materials['Kitsu_'+key])
 for poly in d.polygons:poly.use_smooth=True
 return o
cap=bpy.data.objects['Hair_Underlayer']
for v in cap.data.vertices:
 v.co.z=2.08+(v.co.z-1.92)*.79
 v.co.y=-(-v.co.y+.15)*.87+.15
o=shell('Rear_HairCoverage',(0,1.22,-.43),(.96,.60,.43),'Hair');o['silhouette']=True
for side in (-1,1):shell('Ear_ClosedBack_'+str(side),(side*1.015,1.07,-.005),(.25,.295,.15),'Skin',20,12)
for o in col.objects:
 if o.type!='MESH':continue
 if o.name=='Smile_Curved':
  for v in o.data.vertices:v.co.y+=.088
 if o.get('batch')=='CheekMarks':
  for v in o.data.vertices:
   x=v.co.x;y=v.co.z
   v.co.y=-.79*math.sqrt(max(.01,1-(x/1.01)**2-((y-1.18)/.648)**2))-.025
# Moderate studio lighting avoids bleaching the gold and skin.
for name,color in [('Hair',(1,.40,.012,1)),('Skin',(1,.43,.24,1))]:
 m=bpy.data.materials['Kitsu_'+name];n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs[0].default_value=color;m.diffuse_color=color
scene=bpy.context.scene
for o in scene.objects:
 if o.type=='LIGHT':o.data.energy*=.65
scene.render.film_transparent=True
for name,angle in [('front',0),('three-quarter',.55),('side',pi/2),('rear',pi)]:
 scene.camera.location=(7*sin(angle),-7*cos(angle),1.6)
 scene.camera.rotation_euler=(Vector((0,0,1.6))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/'+name+'.png'
 bpy.ops.render.render(write_still=True)
scene.camera.location=(0,-7,1.6);scene.camera.rotation_euler=(Vector((0,0,1.6))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/kitsu-head-master.blend')
