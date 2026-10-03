"""Actual four-view/profile renders and matching original-coil comparison.
Import current procedural heads for the baseline without touching their assets.
"""
import bpy, math
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/roster/candidates'
SCALE=1.4095778163892174
for name,character in [('Kairo','nova'),('Pomu','cloud'),('Shiro','eclipse')]:
    s=bpy.data.scenes[name+'_Roster_Review'];bpy.context.window.scene=s;cam=s.camera
    master=bpy.data.collections[name+'_Editable_Sculpt'];studio=bpy.data.collections[name+'_Studio']
    def render(label,angle,height=1.55,ortho=3.35):
        cam.data.ortho_scale=ortho;cam.location=(7*math.sin(angle),-7*math.cos(angle),height);cam.rotation_euler=(Vector((0,0,height))-cam.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=BASE+'/'+name.lower()+'/renders/'+label+'.png';bpy.ops.render.render(write_still=True)
    for view,angle in [('front',0),('three-quarter',math.pi/4),('side',math.pi/2),('back',math.pi)]:render(view,angle)
    master.hide_render=True
    for profile in ('desktop','mobile'):
        col=bpy.data.collections[name+'_Export_'+profile];col.hide_render=False
        for view,angle in [('front',0),('side',math.pi/2)]:render(profile+'-'+view,angle)
        col.hide_render=True
    master.hide_render=False
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review/scale-heads/'+character+'.glb')
    imported=[o for o in bpy.data.objects if o not in before];comparison=bpy.data.collections.new(name+'_Current_Head_Comparison');s.collection.children.link(comparison)
    for o in imported:
        for col in list(o.users_collection):col.objects.unlink(o)
        comparison.objects.link(o);o.name=name+'_Baseline_'+o.name
        if o.parent is None:o.scale/=SCALE
    master.hide_render=True
    for view,angle in [('front',0),('side',math.pi/2),('three-quarter',math.pi/4)]:render('baseline-'+view,angle)
    comparison.hide_render=True;comparison.hide_viewport=True;master.hide_render=False
    # Exact dimensions/topology of the game's 352-triangle mount; separate study only.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=(0,.18,.25))
    coil=bpy.context.object;coil.name=name+'_Original_Coil_Attachment_Study';coil.scale=(.91,.84,.55)
    for col in list(coil.users_collection):col.objects.unlink(coil)
    studio.objects.link(coil)
    palette={'nova':(63,185,225),'cloud':(245,116,143),'eclipse':(170,130,224)}
    def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    m=bpy.data.materials.new(name+'_Coil_Study_Material');m.use_nodes=True;n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs[0].default_value=tuple(lin(v/255) for v in palette[character])+(1,);n.inputs[2].default_value=.86;n.inputs[14].default_value=.12;coil.data.materials.append(m)
    for p in coil.data.polygons:p.use_smooth=True
    for view,angle in [('front',0),('three-quarter',math.pi/4),('side',math.pi/2)]:render('coil-fit-'+view,angle,1.42,3.65)
    coil.hide_render=True;coil.hide_set(True);render('three-quarter',math.pi/4)
    bpy.ops.wm.save_as_mainfile(filepath=BASE+'/'+name.lower()+'/'+name.lower()+'-editable.blend')
print('Four views, both profiles, current-head comparisons and original-coil attachment studies complete.')
