"""Render matching game scale and independent blink clones in the review studio."""
import bpy, math
from mathutils import Vector
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/chibi-naruto'
s=bpy.data.scenes['Kitsu_Chibi_Naruto_Review'];bpy.context.window.scene=s;c=s.camera
master=bpy.data.collections['Kitsu_Chibi_Naruto'];root=bpy.data.objects['Chibi_Head']
coil=bpy.data.objects['Chibi_ExistingCoil_DimensionsStudy'];roster=bpy.data.collections['Kitsu_Chibi_Naruto_RosterStudy']
def camera_at(x,height,scale):
    c.location=(x,-9,height);c.rotation_euler=(Vector((x,0,height))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
root.location.x=-4.5;coil.location.x=-4.5;coil.hide_render=False;coil.hide_set(False)
roster.hide_render=False;roster.hide_viewport=False
s.render.resolution_x=1800;s.render.resolution_y=700;camera_at(0,1.42,12.7)
s.render.filepath=OUT+'/roster-scale.png';bpy.ops.render.render(write_still=True)
root.location.x=0;coil.location.x=0;coil.hide_render=True;coil.hide_set(True)
roster.hide_render=True;roster.hide_viewport=True
name='Kitsu_Chibi_Naruto_BlinkStudy';old=bpy.data.collections.get(name)
if old:
    for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(old)
blink=bpy.data.collections.new(name);s.collection.children.link(blink)
source=bpy.data.collections['Kitsu_Chibi_Naruto_Export_desktop']
for side,offset in [('Open',-1.5),('Blink',1.5)]:
    copied={}
    for o in source.objects:
        clone=o.copy();blink.objects.link(clone);clone.name='Chibi_BlinkStudy_'+side+'_'+o.name;copied[o]=clone
    for o,clone in copied.items():
        clone.parent=copied.get(o.parent);clone.matrix_parent_inverse=o.matrix_parent_inverse.copy()
        if not clone.parent:clone.location.x=offset
        if side=='Blink' and o.get('previewEye'):clone.scale.z=.12
master.hide_render=True;camera_at(0,1.60,6.5)
s.render.resolution_x=1500;s.render.resolution_y=850
s.render.filepath=OUT+'/independent-blink.png';bpy.ops.render.render(write_still=True)
blink.hide_render=True;blink.hide_viewport=True;master.hide_render=False
s.render.resolution_x=1000;s.render.resolution_y=1000;camera_at(0,1.60,3.15)
s.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_rotation=c.rotation_euler.to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-chibi-naruto.blend')
print('Roster scale and independent blink rendered. Original mount and studio visibility restored.')
