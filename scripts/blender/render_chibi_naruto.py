"""Actual Blender review renders, evaluated profiles and original-coil fit."""
import bpy, math
from mathutils import Vector
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/chibi-naruto'
s=bpy.data.scenes['Kitsu_Chibi_Naruto_Review'];bpy.context.window.scene=s;c=s.camera
master=bpy.data.collections['Kitsu_Chibi_Naruto']
studio=bpy.data.collections['Kitsu_Chibi_Naruto_Studio']
def render(name,angle,height=1.60):
    c.location=(7*math.sin(angle),-7*math.cos(angle),height)
    c.rotation_euler=(Vector((0,0,height))-c.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=OUT+'/'+name+'.png';bpy.ops.render.render(write_still=True)
for name,angle in [('front',0),('three-quarter',math.pi/4),('side',math.pi/2),('back',math.pi)]:render(name,angle)
master.hide_render=True
for profile in ('desktop','mobile'):
    col=bpy.data.collections['Kitsu_Chibi_Naruto_Export_'+profile];col.hide_render=False
    for name,angle in [('front',0),('side',math.pi/2)]:render(profile+'-'+name,angle)
    col.hide_render=True
master.hide_render=False
old=bpy.data.objects.get('Chibi_ExistingCoil_DimensionsStudy')
if old:bpy.data.objects.remove(old,do_unlink=True)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=(0,.18,.25))
coil=bpy.context.object;coil.name='Chibi_ExistingCoil_DimensionsStudy';coil.scale=(.91,.84,.55)
for col in list(coil.users_collection):col.objects.unlink(coil)
studio.objects.link(coil)
m=bpy.data.materials.new('Chibi_CoilStudy');m.use_nodes=True
node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs[0].default_value=(1,.29177,.08438,1);node.inputs[2].default_value=.83;node.inputs[14].default_value=.12
coil.data.materials.append(m)
for polygon in coil.data.polygons:polygon.use_smooth=True
c.data.ortho_scale=3.50
for name,angle in [('front',0),('three-quarter',math.pi/4)]:render('coil-fit-'+name,angle,1.42)
coil.hide_render=True;coil.hide_set(True)
# Previous mature candidate under the same lights and camera, without changing
# its original scene, materials, editable meshes or saved file.
comparison=bpy.data.collections.get('Kitsu_Chibi_Naruto_MatureComparison')
if comparison:
    for o in list(comparison.objects):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(comparison)
comparison=bpy.data.collections.new('Kitsu_Chibi_Naruto_MatureComparison');s.collection.children.link(comparison)
for source in bpy.data.collections['Kitsu_AnimeReference_Editable'].objects:
    if source.type!='MESH':continue
    o=source.copy();comparison.objects.link(o);o.parent=None;o.matrix_world=source.matrix_world.copy();o.name='Chibi_MatureCompare_'+source.name
master.hide_render=True;c.data.ortho_scale=3.15
render('mature-matched-front',0);render('mature-matched-side',math.pi/2)
comparison.hide_render=True;comparison.hide_viewport=True;master.hide_render=False
c.data.ortho_scale=3.15;c.location=(0,-7,1.60);c.rotation_euler=(Vector((0,0,1.60))-c.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_rotation=c.rotation_euler.to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-chibi-naruto.blend')
print('Master four views, both optimized profiles, coil fit and matched mature comparison rendered.')
