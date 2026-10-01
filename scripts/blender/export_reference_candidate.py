"""Optimize evaluated copies of the review master. Never write public game assets.
Does not call corrected_shape/profile_shape or reconstruct approved geometry.
"""
import bpy, math, json
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/reference-rebuild'
scene=bpy.data.scenes['Kitsu_Reference_Rebuild_Review']
bpy.context.window.scene=scene
master=bpy.data.collections['Kitsu_Reference_Rebuild']
depsgraph=bpy.context.evaluated_depsgraph_get()
results=[]
for profile in ('desktop','mobile'):
    mobile=profile=='mobile'
    cname='Kitsu_Rebuild_Export_'+profile
    old=bpy.data.collections.get(cname)
    if old:
        for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(old)
    canonical=['KitsuHead_'+profile,'KitsuSculptMount_'+profile,'EyesPivot_'+profile]+['Kitsu_'+key+'_'+profile for key in ('Skin','EyeWhites','Pupils','Highlights','Hair','Fabric','Metal','Details','CheekMarks','Mouth')]
    preserved=[]
    for name in canonical:
        original=bpy.data.objects.get(name)
        if original:
            preserved.append((original,name));original.name=name+'__PreservedOriginal'
    col=bpy.data.collections.new(cname);scene.collection.children.link(col)
    root=bpy.data.objects.new('KitsuHead_'+profile,None);col.objects.link(root)
    root['assetVersion']='1.6.9';root['reviewStatus']='AWAITING_USER_VISUAL_APPROVAL'
    mount=bpy.data.objects.new('KitsuSculptMount_'+profile,None);col.objects.link(mount);mount.parent=root;mount.location=(0,0,.12)
    eye=bpy.data.objects.new('EyesPivot_'+profile,None);col.objects.link(eye);eye.parent=mount;eye.location=(0,0,1.28);eye['previewEye']=True
    batches={}
    for source in master.objects:
        if source.type!='MESH':continue
        o=source.copy();o.data=bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
        o.modifiers.clear();col.objects.link(o);o.parent=eye if source.parent.get('previewEye') else mount
        key=source['batch'];name=source.name
        ratio=(.27 if mobile else .40)
        if source.get('ringSegments'):
            # Sample existing approved loops. No shape regeneration, and no wavy
            # band borders caused by unconstrained triangle collapse.
            n=source['ringSegments'];rows=source['ringCount'];stride=4 if mobile else 2;count=n//stride
            verts=[tuple(o.data.vertices[j*n+i].co) for j in range(rows) for i in range(0,n,stride)]
            faces=[]
            for j in range(rows):
                for i in range(count):faces.append((j*count+i,j*count+(i+1)%count,((j+1)%rows)*count+(i+1)%count,((j+1)%rows)*count+i))
            o.data.clear_geometry();o.data.from_pydata(verts,[],faces);o.data.update()
            for p in o.data.polygons:p.use_smooth=True
            ratio=1
        if 'CohesiveSkull' in name:ratio=.14 if mobile else .22
        elif 'ThinRecessedEar' in name:ratio=.25 if mobile else .42
        elif 'UpperLid' in name:ratio=.20 if mobile else .30
        elif 'SoftNose' in name:ratio=.20 if mobile else .30
        elif name.startswith('Rebuild_Hair_'):ratio=.48 if mobile else .74
        elif 'ContinuousHairCap' in name:ratio=.40 if mobile else .50
        elif 'FittedRearHairShell' in name:ratio=.09 if mobile else .15
        elif 'Headband' in name:ratio=1
        elif 'RearKnot' in name:ratio=.20 if mobile else .30
        elif 'FabricTie' in name:ratio=1
        elif key=='Highlights':ratio=.35 if mobile else .50
        elif key=='Metal':ratio=.22 if mobile else .30
        elif key=='Details':ratio=.23 if mobile else .30
        elif key=='CheekMarks':ratio=.20 if mobile else .30
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        if ratio<1:
            mod=o.modifiers.new('Candidate profile optimization','DECIMATE');mod.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)
        batches.setdefault(key,[]).append(o)
    for key,objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        o=objects[0];o.name='Kitsu_'+key+'_'+profile
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        o.data.validate();o.data.update();o['batch']=key
        if key in ('Hair','Fabric'):o['silhouette']=True
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')
    assert triangles+352<=(4000 if mobile else 6000),(profile,triangles)
    assert len(batches)==10
    assert all(math.isfinite(v) for o in col.objects if o.type=='MESH' for vertex in o.data.vertices for v in vertex.co)
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/kitsu-head-'+profile+'.glb',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    # Keep canonical names inside GLBs while restoring original scene identities.
    for o in col.objects:o.name='Review_'+o.name
    for original,name in preserved:original.name=name
    col.hide_render=True;col.hide_viewport=True
    results.append({'profile':profile,'assetTriangles':triangles,'withExistingCoil':triangles+352,'assetDraws':len(batches)})
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-head-reference-rebuild.blend')
print(json.dumps(results))
