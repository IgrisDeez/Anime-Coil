import bpy, json
scene=bpy.context.scene
master=bpy.data.collections['Kitsu_169_Editable_Master']
results=[]
for profile,ratio in [('desktop',.40),('mobile',.13)]:
 old=bpy.data.collections.get('Kitsu_169_Export_'+profile)
 if old:
  for o in list(old.objects):
   data=o.data;bpy.data.objects.remove(o,do_unlink=True)
   if data and data.users==0:bpy.data.meshes.remove(data)
  bpy.data.collections.remove(old)
 col=bpy.data.collections.new('Kitsu_169_Export_'+profile);scene.collection.children.link(col)
 root=bpy.data.objects.new('KitsuHead_'+profile,None);col.objects.link(root);root['assetVersion']='1.6.9'
 mount=bpy.data.objects.new('KitsuSculptMount_'+profile,None);col.objects.link(mount);mount.parent=root;mount.location=(0,0,.12)
 eye=bpy.data.objects.new('EyesPivot_'+profile,None);col.objects.link(eye);eye.parent=mount;eye.location=(0,0,1.28);eye['previewEye']=True
 batches={}
 for source in master.objects:
  if source.type!='MESH':continue
  o=source.copy();o.data=source.data.copy();col.objects.link(o)
  o.parent=eye if source.parent.name=='EyesPivot' else mount
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  if not corrected_shape(o,source.name,profile) and not profile_shape(o,source,profile):
   mod=o.modifiers.new('Export reduction','DECIMATE');mod.ratio=ratio
   bpy.ops.object.modifier_apply(modifier=mod.name)
  if source.name in HAIR and not source.name.startswith('Front_'):
   mod=o.modifiers.new('Hair profile reduction','DECIMATE');mod.ratio=.70 if profile=='desktop' else .33
   bpy.ops.object.modifier_apply(modifier=mod.name)
  key=source.get('batch');batches.setdefault(key,[]).append(o)
 for key,objects in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
  o=objects[0];o.name='Kitsu_'+key+'_'+profile
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  if key in ('Hair','Fabric'):o['silhouette']=True
  o.data.validate();o.data.update()
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.objects:o.select_set(True)
 triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')
 results.append({'profile':profile,'triangles':triangles,'draws':len(batches)})
 path='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/public/assets/kitsu/kitsu-head-'+profile+'.glb'
 bpy.ops.export_scene.gltf(filepath=path,use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
 col.hide_render=True;col.hide_viewport=True
print(json.dumps(results))
# Master retains editable pieces and hidden optimized exports; original scene intact.
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/kitsu-head-master.blend')




