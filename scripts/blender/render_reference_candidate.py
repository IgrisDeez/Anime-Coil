"""Four views plus exact existing attachment ellipsoid; no game substitution."""
import bpy, math, bmesh
from mathutils import Vector
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/reference-rebuild'
s=bpy.data.scenes['Kitsu_Reference_Rebuild_Review'];bpy.context.window.scene=s
master=bpy.data.collections['Kitsu_Reference_Rebuild'];c=s.camera
def camera(pos,target=(0,0,1.75),scale=3.15):
    c.location=pos;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
def render(name):
    s.render.filepath=OUT+'/'+name+'.png';bpy.ops.render.render(write_still=True)
for name,pos in [('front',(0,-7,1.75)),('three-quarter',(4.2,-5.6,1.85)),('side',(7,0,1.75)),('back',(0,7,1.75)),('reference-side',(6.06,-3.50,1.85))]:
    camera(pos);render(name)
# Old sculpture, same camera and lighting, temporarily linked without editing it.
master.hide_render=True
previous=bpy.data.collections['Kitsu_169_Editable_Master'];s.collection.children.link(previous)
for name,pos in [('previous-front',(0,-7,1.75)),('previous-side',(7,0,1.75))]:
    camera(pos);render(name)
s.collection.children.unlink(previous);master.hide_render=False
# Inspect optimized profiles, not just the dense editable master.
master.hide_render=True
for profile in ('desktop','mobile'):
    col=bpy.data.collections['Kitsu_Rebuild_Export_'+profile];col.hide_render=False
    for name,pos in [('front',(0,-7,1.75)),('three-quarter',(4.2,-5.6,1.85)),('side',(7,0,1.75)),('back',(0,7,1.75))]:
        camera(pos);render(profile+'-'+name)
    col.hide_render=True
master.hide_render=False
# The model code adds SphereGeometry(1,16,12), scale(.91,.55,.84), pos(0,.25,-.18).
fit=bpy.data.collections.new('Kitsu_Rebuild_AttachmentStudy');s.collection.children.link(fit)
v=[];f=[];n=16;rows=12
for j in range(rows+1):
    t=math.pi*j/rows
    for i in range(n):
        a=2*math.pi*i/n;x=.91*math.sin(t)*math.cos(a);y=.25+.55*math.cos(t);z=-.18+.84*math.sin(t)*math.sin(a)
        v.append((x,-z,y))
for j in range(rows):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
d=bpy.data.meshes.new('Existing_352_Triangle_Attachment');d.from_pydata(v,[],f);d.update()
bm=bmesh.new();bm.from_mesh(d);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
o=bpy.data.objects.new('Existing_Coil_Attachment_REVIEW_ONLY',d);fit.objects.link(o)
m=bpy.data.materials.new('ExistingCoil_Orange');m.use_nodes=True
node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs[0].default_value=(1,.292,.084,1);node.inputs[2].default_value=.75
d.materials.append(m)
for p in d.polygons:p.use_smooth=True
for name,pos in [('coil-fit-front',(0,-7,1.40)),('coil-fit-three-quarter',(4.2,-5.6,1.65))]:
    camera(pos,(0,0,1.40),3.65);render(name)
fit.hide_render=True;fit.hide_viewport=True
camera((0,-7,1.75));s.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-head-reference-rebuild.blend')
print('Four studio angles, reference-matched side, both optimized profiles, and exact coil-fit studies saved.')
