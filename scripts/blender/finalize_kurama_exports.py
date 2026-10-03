import bpy
s=bpy.data.scenes['Kurama_Chibi_Review'];bpy.context.window.scene=s
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review'
for profile in ['desktop','mobile']:
    c=bpy.data.collections['Kurama_Export_'+profile];c.hide_viewport=False
    originals=[(o,o.name) for o in bpy.data.objects if o.name.startswith('fox-')]
    for o,name in originals:o.name='Saved_'+name
    for o in c.objects:
        saved=next((name for old,name in originals if old==o),None)
        if saved:o.name=saved.split('.')[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/kurama-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
    for o,name in originals:o.name='Restore_'+name
    for o,name in originals:o.name=name
    for o in c.objects:o.select_set(False)
    c.hide_viewport=True
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kurama-chibi-master.blend')
