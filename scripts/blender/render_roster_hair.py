"""Render exact candidate/baseline geometry in the same Blender studio."""
import bpy, math
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/roster/hair-review'

def render_hair_character(name, pass_name='review'):
    s=bpy.data.scenes[name+'_Textured_Hair_Review'];bpy.context.window.scene=s
    cam=s.camera
    def render(label,angle,height=1.55,ortho=3.35):
        cam.data.ortho_scale=ortho;cam.location=(7*math.sin(angle),-7*math.cos(angle),height)
        cam.rotation_euler=(Vector((0,0,height))-cam.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=OUT+'/'+name.lower()+'/renders/'+label+'.png';bpy.ops.render.render(write_still=True)
    views=[('front',0),('three-quarter',math.pi/4),('side',math.pi/2),('back',math.pi)]
    for profile in ['desktop','mobile']:
        col=bpy.data.collections[name+'_Textured_Hair_'+profile];col.hide_render=False
        for other in ['desktop','mobile']:
            if other!=profile:bpy.data.collections[name+'_Textured_Hair_'+other].hide_render=True
        for view,angle in views:render(profile+'-'+view,angle)
        col.hide_render=True
    if pass_name=='final':
        before=bpy.data.collections[name+'_Untouched_Head_desktop'];before.hide_render=False
        for view,angle in views:render('before-'+view,angle)
        before.hide_render=True
        col=bpy.data.collections[name+'_Textured_Hair_desktop'];col.hide_render=False
        # The exact unchanged 352-triangle game coil, study only.
        studio=bpy.data.collections[name+'_Hair_Studio']
        coil=next((o for o in studio.objects if o.get('attachmentStudy')),None)
        if coil is None:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=12,location=(0,.18,.25))
            coil=bpy.context.object;coil.name=name+'_Unchanged_Coil_Study';coil['attachmentStudy']=True;coil.scale=(.91,.84,.55)
            for c in list(coil.users_collection):c.objects.unlink(coil)
            studio.objects.link(coil)
            m=bpy.data.materials.new(name+'_Coil_Study');m.use_nodes=True
            n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            palette={'Kitsu':(255,144,70),'Kairo':(63,185,225),'Pomu':(245,116,143),'Shiro':(170,130,224)}
            def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
            n.inputs['Base Color'].default_value=tuple(lin(v/255) for v in palette[name])+(1,);n.inputs['Roughness'].default_value=.86;n.inputs['Specular IOR Level'].default_value=.12;coil.data.materials.append(m)
            for p in coil.data.polygons:p.use_smooth=True
        coil.hide_render=False;coil.hide_set(False)
        for view,angle in [('front',0),('three-quarter',math.pi/4),('side',math.pi/2)]:render('coil-'+view,angle,1.42,3.65)
        coil.hide_render=True;coil.hide_set(True)
    bpy.data.collections[name+'_Textured_Hair_desktop'].hide_render=False
    cam.data.ortho_scale=3.35;cam.location=(4.9497,-4.9497,1.55);cam.rotation_euler=(Vector((0,0,1.55))-cam.location).to_track_quat('-Z','Y').to_euler()
    print(name,'actual renders complete',pass_name)
