import bpy
from mathutils import Vector
s=bpy.data.scenes['Kurama_Chibi_Review'];bpy.context.window.scene=s
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review'
study=bpy.data.collections.new('Kurama_Current_Roster_Scale_Study');s.collection.children.link(study)
for i,character in enumerate(['ember','eclipse','cloud','nova']):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=OUT+'/scale-heads/'+character+'.glb')
    imported=[o for o in bpy.data.objects if o not in before]
    for o in imported:
        for c in list(o.users_collection):c.objects.unlink(o)
        study.objects.link(o)
        if o.parent is None:o.location=Vector(((i-1.5)*7.5,-15,0))
    study['snakeMass']=48;study['snakeVisualScale']=1.4095778163892174;study['source']='Actual createHead output, current Kitsu eye fixes, original coil retained'
root=bpy.data.objects['Kurama_Master'];root.scale=(1.8,1.8,1.8)
cam=s.camera;cam.data.ortho_scale=80;cam.location=(20,-100,46);cam.rotation_euler=(Vector((0,-2,24))-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.resolution_x=1500;s.render.resolution_y=1300;s.render.filepath=OUT+'/renders/matching-scale-coil-study.png';bpy.ops.render.render(write_still=True)
root.scale=(1,1,1);study.hide_render=True;study.hide_viewport=True
cam.data.ortho_scale=36;cam.location=(52,-52,24);cam.rotation_euler=(Vector((0,0,14))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=1000;s.render.resolution_y=1000
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kurama-chibi-master.blend')
print('Current roster and original coil compared at actual 48-mass scale; summon scale 1.8')
