"""Evaluate optimized copies of the chibi review master through Blender MCP.
The fitted band and all fifteen authored hair tips are preserved on both profiles.
Exports stay in the candidate folder; public game assets are never written.
"""
import bpy, math, json
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/chibi-naruto'
scene=bpy.data.scenes['Kitsu_Chibi_Naruto_Review'];bpy.context.window.scene=scene
master=bpy.data.collections['Kitsu_Chibi_Naruto']
depsgraph=bpy.context.evaluated_depsgraph_get()
KEYS=('Skin','EyeWhites','Pupils','Iris','Highlights','Hair','Fabric','Metal','Details','CheekMarks','Mouth')
results=[]
for profile in ('desktop','mobile'):
    mobile=profile=='mobile';cname='Kitsu_Chibi_Naruto_Export_'+profile
    old=bpy.data.collections.get(cname)
    if old:
        for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(old)
    canonical=['KitsuHead_'+profile,'KitsuSculptMount_'+profile,'EyesPivot_'+profile]+['Kitsu_'+k+'_'+profile for k in KEYS]
    preserved=[]
    for name in canonical:
        original=bpy.data.objects.get(name)
        if original:preserved.append((original,name));original.name=name+'__PreservedOriginal'
    col=bpy.data.collections.new(cname);scene.collection.children.link(col)
    try:
        root=bpy.data.objects.new('KitsuHead_'+profile,None);col.objects.link(root)
        root['assetVersion']='1.7.0-chibi-review';root['reviewStatus']='AWAITING_VISUAL_APPROVAL'
        mount=bpy.data.objects.new('KitsuSculptMount_'+profile,None);col.objects.link(mount);mount.parent=root;mount.location=(0,0,.12)
        eyes=bpy.data.objects.new('EyesPivot_'+profile,None);col.objects.link(eyes);eyes.parent=mount;eyes.location=(0,0,1.28);eyes['previewEye']=True
        batches={}
        for source in master.objects:
            if source.type!='MESH':continue
            o=source.copy();o.data=bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
            o.modifiers.clear();col.objects.link(o);o.parent=eyes if source.parent.get('previewEye') else mount
            key=source['batch'];ratio=1
            if key=='Skin':
                if 'SoftCheeks' in source.name:ratio=.16 if mobile else .45
                elif 'UpperLid' in source.name:ratio=.20 if mobile else .35
                elif 'Nose' in source.name:ratio=.25 if mobile else .42
                else:ratio=.35 if mobile else .55
            elif key=='EyeWhites':ratio=.40 if mobile else .65
            elif key in ('Pupils','Iris'):ratio=.32 if mobile else .60
            elif key=='Highlights':ratio=.25 if mobile else .40
            elif key=='Details':ratio=.22 if mobile else .50
            elif key=='CheekMarks':ratio=.28 if mobile else .55
            elif key=='Mouth':ratio=.30 if mobile else .60
            elif key=='Metal':ratio=.60 if mobile else .85
            # The 15-lock connected scalp and fitted cloth retain their authored
            # vertices. Reduction concentrates on invisible face/detail density.
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            if ratio<1:
                mod=o.modifiers.new('Review profile reduction','DECIMATE');mod.ratio=ratio
                bpy.ops.object.modifier_apply(modifier=mod.name)
            batches.setdefault(key,[]).append(o)
        per_batch={}
        for key,objects in batches.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
            o=objects[0];o.name='Kitsu_'+key+'_'+profile
            bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
            o.data.validate();o.data.update();o['batch']=key
            if key in ('Hair','Fabric'):o['silhouette']=True
            if key=='Hair':o['lockCount']=15
            per_batch[key]=sum(len(p.vertices)-2 for p in o.data.polygons)
        triangles=sum(per_batch.values())
        print(json.dumps({'profile':profile,'triangles':triangles,'perBatch':per_batch}))
        assert triangles+352<=(4000 if mobile else 6000),(profile,triangles)
        assert len(batches)==11
        assert all(math.isfinite(v) for o in col.objects if o.type=='MESH' for vertex in o.data.vertices for v in vertex.co)
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=OUT+'/kitsu-head-'+profile+'.glb',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
        results.append({'profile':profile,'assetTriangles':triangles,'withExistingCoil':triangles+352,'assetDraws':len(batches),'drawsWithCoil':12})
    finally:
        for o in col.objects:o.name='ChibiReview_'+o.name
        for original,name in preserved:original.name=name
        col.hide_render=True;col.hide_viewport=True
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-chibi-naruto.blend')
print(json.dumps(results))
