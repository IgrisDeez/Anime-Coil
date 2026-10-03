"""Bake profile candidates through Blender MCP. Keep all masters and old scenes.
GLBs contain the head only; the runtime retains the existing 352-triangle coil.
"""
import bpy, bmesh, math, json
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/roster/candidates'
LIMITS={
 'desktop':{'Skin':1800,'EyeWhites':430,'Pupils':500,'Iris':210,'Highlights':90,'FaceInk':200,'Blush':80,'Mouth':220,'Hair':674,'Hat':950,'HatBand':240,'Fabric':1000,'Trim':32},
 'mobile':{'Skin':1050,'EyeWhites':280,'Pupils':300,'Iris':140,'Highlights':60,'FaceInk':110,'Blush':40,'Mouth':100,'Hair':674,'Hat':560,'HatBand':144,'Fabric':650,'Trim':32},
}
for name,character in [('Kairo','nova'),('Pomu','cloud'),('Shiro','eclipse')]:
    s=bpy.data.scenes[name+'_Roster_Review'];bpy.context.window.scene=s
    master=bpy.data.collections[name+'_Editable_Sculpt'];bpy.context.view_layer.update();stats=[]
    for profile in ('desktop','mobile'):
        if bpy.data.collections.get(name+'_Export_'+profile):raise RuntimeError('Existing exports preserved; do not overwrite a loaded collection.')
        col=bpy.data.collections.new(name+'_Export_'+profile);s.collection.children.link(col)
        root=bpy.data.objects.new(name+'Head_'+profile,None);col.objects.link(root);root['schemaVersion']=1;root['characterId']=character;root['candidate']=True
        mount=bpy.data.objects.new(name+'SculptMount_'+profile,None);col.objects.link(mount);mount.parent=root;mount.location=(0,0,.12)
        eyes=bpy.data.objects.new(name+'EyesPivot_'+profile,None);col.objects.link(eyes);eyes.parent=mount;eyes.location=(0,0,1.28);eyes['previewEye']=True
        batches={}
        for source in master.objects:
            if source.type!='MESH':continue
            o=source.copy();o.data=source.data.copy();o.modifiers.clear();col.objects.link(o)
            o.parent=eyes if source.parent.get('previewEye') else mount
            batches.setdefault(source['batch'],[]).append(o)
        counts={}
        for key,objects in batches.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0]
            o.name=name+'_'+key+'_'+profile;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
            tri=sum(len(p.vertices)-2 for p in o.data.polygons);limit=LIMITS[profile][key]
            if tri>limit:
                m=o.modifiers.new('Applied profile reduction','DECIMATE');m.decimate_type='COLLAPSE';m.ratio=(limit-6)/tri;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
            m=o.modifiers.new('Applied triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=m.name)
            o.data.validate();o.data.update();o['batch']=key;o['silhouette']=key in ('Hair','Hat','Fabric');o['sharedAssetGeometry']=True
            counts[key]=len(o.data.polygons)
            assert not o.modifiers and all(math.isfinite(x) for v in o.data.vertices for x in v.co)
        total=sum(counts.values());assert total+352<=(6000 if profile=='desktop' else 4000),(name,profile,total)
        assert len(counts)+1<=12,(name,profile,counts)
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=BASE+'/'+name.lower()+'/'+name.lower()+'-head-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
        stats.append({'profile':profile,'headTriangles':total,'trianglesWithOriginalCoil':total+352,'headDraws':len(counts),'drawsWithOriginalCoil':len(counts)+1,'perBatch':counts})
        col.hide_render=True;col.hide_viewport=True
    root=bpy.data.objects[name+'_Master'];root['profileStats']=json.dumps(stats)
    bpy.ops.wm.save_as_mainfile(filepath=BASE+'/'+name.lower()+'/'+name.lower()+'-editable.blend')
    print(name,json.dumps(stats))
