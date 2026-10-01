"""Render editable and evaluated candidate profiles through Blender MCP."""
import bpy, math
from mathutils import Vector
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/anime-reference'
s=bpy.data.scenes['Kitsu_AnimeReference_Review'];bpy.context.window.scene=s;c=s.camera
master=bpy.data.collections['Kitsu_AnimeReference_Editable']
def render(name,angle,height=1.85):
    c.location=(7*math.sin(angle),-7*math.cos(angle),height)
    c.rotation_euler=(Vector((0,0,height))-c.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=OUT+'/'+name+'.png';bpy.ops.render.render(write_still=True)
for name,angle in [('front',0),('three-quarter',math.pi/4),('side',math.pi/2),('back',math.pi)]:render(name,angle)
master.hide_render=True
for profile in ('desktop','mobile'):
    col=bpy.data.collections['Kitsu_AnimeReference_Export_'+profile];col.hide_render=False
    for name,angle in [('front',0),('side',math.pi/2)]:render(profile+'-'+name,angle)
    col.hide_render=True
master.hide_render=False
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=(0,.18,.25))
coil=bpy.context.object;coil.name='AnimeRef_ExistingCoil_DimensionsStudy';coil.scale=(.91,.84,.55)
for col in list(coil.users_collection):col.objects.unlink(coil)
bpy.data.collections['Kitsu_AnimeReference_Studio'].objects.link(coil)
m=bpy.data.materials.new('AnimeRef_CoilStudy');m.use_nodes=True
node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs[0].default_value=(1,.29177,.08438,1);node.inputs[2].default_value=.82;coil.data.materials.append(m)
for polygon in coil.data.polygons:polygon.use_smooth=True
c.data.ortho_scale=3.8
for name,angle in [('front',0),('three-quarter',math.pi/4)]:render('coil-fit-'+name,angle,1.55)
coil.hide_render=True;coil.hide_set(True)
c.data.ortho_scale=3.45;c.location=(0,-7,1.85);c.rotation_euler=(Vector((0,0,1.85))-c.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=OUT+'/front.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-anime-reference.blend')
print('All editable, optimized and coil-fit views rendered.')
