"""Export only the independently reviewed AnimeReference candidate through MCP."""
import bpy, math, json
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/anime-reference'
scene=bpy.data.scenes['Kitsu_AnimeReference_Review'];bpy.context.window.scene=scene
master=bpy.data.collections['Kitsu_AnimeReference_Editable']
depsgraph=bpy.context.evaluated_depsgraph_get()
KEYS=('Skin','EyeWhites','Pupils','Iris','Highlights','Hair','Fabric','Metal','Details','CheekMarks','Mouth')
results=[]
for profile in ('desktop','mobile'):
    mobile=profile=='mobile';cname='Kitsu_AnimeReference_Export_'+profile
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
    root=bpy.data.objects.new('KitsuHead_'+profile,None);col.objects.link(root)
    root['assetVersion']='1.6.9';root['reviewStatus']='AWAITING_VISUAL_APPROVAL'
    mount=bpy.data.objects.new('KitsuSculptMount_'+profile,None);col.objects.link(mount);mount.parent=root;mount.location=(0,0,.12)
    eyes=bpy.data.objects.new('EyesPivot_'+profile,None);col.objects.link(eyes);eyes.parent=mount;eyes.location=(0,0,1.57);eyes['previewEye']=True
    batches={}
    for source in master.objects:
        if source.type!='MESH':continue
        o=source.copy();o.data=bpy.data.meshes.new_from_object(source.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
        o.modifiers.clear();col.objects.link(o);o.parent=eyes if source.parent.get('previewEye') else mount
        key=source['batch'];ratio=1
        if key=='Skin':ratio=.58 if mobile else 1
        elif key=='Hair':ratio=.88 if mobile else 1
        elif key=='EyeWhites':ratio=.47 if mobile else .70
        elif key in ('Pupils','Iris'):ratio=.38 if mobile else .62
        elif key=='Highlights':ratio=.20 if mobile else .32
        elif key=='Details':ratio=.33 if mobile else .57
        elif key=='CheekMarks':ratio=.32 if mobile else .55
        elif key=='Mouth':ratio=.45 if mobile else .72
        elif key=='Metal':ratio=.55 if mobile else .85
        if 'Headband' in source.name:
            # Preserve all cloth rows; sample the existing circular loop vertices.
            # Keep the fitted cloth boundary intact on both profiles: the
            # flatter forehead needs these samples to avoid skin breakthrough.
            stride=1;n=48;rows=6;count=n//stride
            verts=[tuple(o.data.vertices[j*n+i].co) for j in range(rows) for i in range(0,n,stride)]
            faces=[]
            for j in range(rows):
                for i in range(count):faces.append((j*count+i,j*count+(i+1)%count,((j+1)%rows)*count+(i+1)%count,((j+1)%rows)*count+i))
            o.data.clear_geometry();o.data.from_pydata(verts,[],faces);o.data.update()
            for p in o.data.polygons:p.use_smooth=True
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        if ratio<1:
            mod=o.modifiers.new('Candidate reduction','DECIMATE');mod.ratio=ratio
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
    assert len(batches)==11
    assert all(math.isfinite(v) for o in col.objects if o.type=='MESH' for vertex in o.data.vertices for v in vertex.co)
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/kitsu-head-'+profile+'.glb',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    for o in col.objects:o.name='AnimeReview_'+o.name
    for original,name in preserved:original.name=name
    col.hide_render=True;col.hide_viewport=True
    results.append({'profile':profile,'assetTriangles':triangles,'withExistingCoil':triangles+352,'assetDraws':len(batches),'drawsWithCoil':12})
for m in list(bpy.data.meshes):
    if m.name.startswith('AnimeRef_') and m.users==0:bpy.data.meshes.remove(m)
for m in list(bpy.data.materials):
    if m.name.startswith('AnimeRef_') and m.users==0:bpy.data.materials.remove(m)
for w in list(bpy.data.worlds):
    if w.name.startswith('AnimeRef_') and w.users==0:bpy.data.worlds.remove(w)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-anime-reference.blend')
print(json.dumps(results))
