"""Selected-profile GLBs with packed diffuse maps and no runtime modifiers."""
import bpy, math, json
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/roster/hair-review'

def export_hair_character(name):
    s=bpy.data.scenes[name+'_Textured_Hair_Review'];bpy.context.window.scene=s
    stats=[]
    for profile in ['desktop','mobile']:
        col=bpy.data.collections[name+'_Textured_Hair_'+profile]
        col.hide_viewport=False;col.hide_render=False
        counts={}
        for o in col.objects:
            if o.type!='MESH':continue
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            if o.get('batch')=='Hair':
                tri=o.modifiers.new('Applied final triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
            counts[o['batch']]=sum(len(p.vertices)-2 for p in o.data.polygons)
            assert not o.modifiers and tuple(o.location)==(0,0,0) and tuple(o.scale)==(1,1,1)
            assert all(math.isfinite(n) for v in o.data.vertices for n in v.co)
            assert all(math.isfinite(n) for v in o.data.vertices for n in v.normal)
        total=sum(counts.values());assert total+352<=(6000 if profile=='desktop' else 4000),(name,profile,total)
        assert len(counts)+1<=12
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:o.select_set(True)
        props=bpy.ops.export_scene.gltf.get_rna_type().properties
        def option(key,value):
            assert value in [i.identifier for i in props[key].enum_items],(key,value)
            return value
        bpy.ops.export_scene.gltf(filepath=OUT+'/'+name.lower()+'/'+name.lower()+'-head-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color=option('export_vertex_color','ACTIVE'),export_image_format=option('export_image_format','AUTO'))
        stats.append({'profile':profile,'headTriangles':total,'trianglesWithCoil':total+352,'headDraws':len(counts),'drawsWithCoil':len(counts)+1,'hairTriangles':counts['Hair'],'textureSize':512 if profile=='desktop' else 256,'perBatch':counts})
        col.hide_viewport=profile!='desktop';col.hide_render=profile!='desktop'
    s['hairReviewStats']=json.dumps(stats);s['priorCandidates']='Untouched collections and separate previous asset files preserved'
    bpy.ops.wm.save_as_mainfile(filepath=OUT+'/'+name.lower()+'/'+name.lower()+'-hair-editable.blend')
    print(name,json.dumps(stats))
