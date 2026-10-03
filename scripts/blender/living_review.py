"""Actual studio renders and safe, selected-collection GLB exports via Blender MCP."""
import bpy, bmesh, math, json
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
def B(p):return (p[0],-p[2],p[1])
def enum_value(owner,key,wanted):
    values=[i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if wanted not in values:raise ValueError((key,wanted,values))
    return wanted
def studio(scene,width=720,height=720,dark=False):
    bpy.context.window.scene=scene
    col=bpy.data.collections.get(scene.name+'_Studio')
    if col:return col
    col=bpy.data.collections.new(scene.name+'_Studio');scene.collection.children.link(col)
    try:scene.render.engine='CYCLES'
    except TypeError:pass
    scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format=enum_value(scene.render.image_settings,'file_format','PNG')
    try:scene.view_settings.view_transform='Standard'
    except TypeError:pass
    scene.world=bpy.data.worlds.new(scene.name+'_Neutral_World');scene.world.use_nodes=True
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.10,.13,.22,1) if dark else (.48,.52,.62,1);bg.inputs['Strength'].default_value=.4
    cam=bpy.data.cameras.new(scene.name+'_Review_Camera');o=bpy.data.objects.new(cam.name,cam);col.objects.link(o);scene.camera=o
    for name,pos,power,size,color in [('Key',(-4,-5,7),650,5,(1,.89,.77)),('Fill',(5,-2,5),450,4,(.72,.83,1)),('Rim',(0,4,6),750,3,(.90,.90,1))]:
        light=bpy.data.lights.new(scene.name+'_'+name,'AREA');light.energy=power;light.shape=enum_value(light,'shape','DISK');light.size=size;light.color=color
        obj=bpy.data.objects.new(light.name,light);col.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    return col
def render_head(angle,profile='desktop',study=False):
    s=bpy.data.scenes['Pomu_Gear5'];col=studio(s);bpy.context.window.scene=s
    for o in s.objects:o.hide_render=o.name not in col.objects
    coil=bpy.data.objects.get('Pomu_Gear5_Coil_Study')
    if coil:coil.hide_render=not study
    asset=bpy.data.collections['Pomu_Gear5_'+profile]
    for o in asset.objects:
        if o.type=='MESH' and o.get('batch') not in ['Hand','Seams']:o.hide_render=False
    if study:
        coil=bpy.data.objects.get('Pomu_Gear5_Coil_Study')
        if not coil:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=B((0,.25,-.18)))
            coil=bpy.context.object;coil.name='Pomu_Gear5_Coil_Study';coil.scale=(.91,.84,.55)
            for c in list(coil.users_collection):c.objects.unlink(coil)
            col.objects.link(coil)
            mat=bpy.data.materials.new('Pomu_Existing_White_Coil');mat.use_nodes=True;p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.86,.83,.94,1);p.inputs['Roughness'].default_value=.9;coil.data.materials.append(mat)
        coil.hide_render=False
    cam=s.camera;target=Vector((0,0,1.5 if not study else 1.3));positions={'front':(0,-7,1.5),'three-quarter':(4.8,-6,2.8),'side':(7,0,1.6),'rear':(0,7,2.1)}
    cam.location=positions[angle];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=3.4 if not study else 3.6
    s.render.filepath=BASE+'/assets/pomu-gear5/v177/renders/'+('attachment' if study else angle)+'-'+profile+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
def city_gallery():
    s=bpy.data.scenes['Living_Shibuya'];bpy.context.window.scene=s;col=studio(s,1200,800,True)
    gallery=bpy.data.collections.new('Living_Shibuya_Gallery');s.collection.children.link(gallery)
    for o in s.objects:o.hide_render=o.name not in col.objects
    for i,family in enumerate(['Rounded','Glass','Shop','Terrace','Station','Arcade']):
        original=bpy.data.objects['City_'+family+'_desktop'];offset=Vector(B(((i%3-1)*26,0,(i//3-.5)*30)))
        for child in original.children:
            o=child.copy();o.data=child.data;o.parent=None;o.location=offset;gallery.objects.link(o);o.hide_render=False
    for name,pos,power in [('Key',(-60,-75,105),104000),('Fill',(75,-30,75),72000),('Rim',(0,60,90),120000)]:
        light=bpy.data.objects[s.name+'_'+name];light.location=pos;light.data.energy=power;light.data.size=60;light.rotation_euler=(Vector((0,0,23))-light.location).to_track_quat('-Z','Y').to_euler()
    cam=s.camera;cam.location=(105,-145,110);target=Vector((0,0,23));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=135
    s.render.filepath=BASE+'/assets/shibuya/v177/renders/city-kit-overview.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)

def city_overview(angle='three-quarter'):
    s=bpy.data.scenes['Living_Shibuya'];col=studio(s,1200,800,True);bpy.context.window.scene=s
    for o in s.objects:o.hide_render=o.name not in col.objects
    review=bpy.data.collections.get('Living_Shibuya_Assembled_Review')
    if not review:
        review=bpy.data.collections.new('Living_Shibuya_Assembled_Review');s.collection.children.link(review)
        def linked(name,position,scale=(1,1,1),rotation=0):
            source=bpy.data.objects[name]
            for mesh in source.children:
                o=mesh.copy();o.data=mesh.data;o.parent=None;o.location=B(position);o.scale=(scale[0],scale[2],scale[1]);o.rotation_euler.z=rotation;review.objects.link(o)
        for i in range(32):
            district=i//8;slot=i%8;a=-district*math.pi/2;depth=28+(slot%3)*3;radius=207+depth/2;along=[-153,-119,-85,-51,51,85,119,153][slot]
            height=96 if slot==4 else 34+(i*19%57);family=['Rounded','Shop','Glass','Terrace'][slot%4]
            if slot%4==1 and i%8==5:family='Arcade'
            linked('City_'+family+'_desktop',(along*math.cos(a)+radius*math.sin(a),0,-along*math.sin(a)-radius*math.cos(a)),(32/18,height/48,depth/14),a)
        linked('City_Station_desktop',(65,0,205),(2.1,2.1,2.1),math.pi)
        linked('City_Meeting_desktop',(98,0,195),(1,1,1),math.pi)
        def paint(name,color,position,size):
            mat=bpy.data.materials.get('City_Review_'+name)
            if not mat:
                mat=bpy.data.materials.new('City_Review_'+name);mat.use_nodes=True;p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.95
            bpy.ops.mesh.primitive_cube_add(size=1,location=B(position));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);o.data.materials.append(mat)
            for c in list(o.users_collection):c.objects.unlink(o)
            review.objects.link(o);return o
        paint('Street',(.022,.035,.07),(0,-.55,0),(620,.1,620))
        for side in range(4):
            a=side*math.pi/2
            for i in range(-9,10):
                x=i*3.6;z=51;o=paint('Crossing',(.39,.51,.63),(x*math.cos(a)+z*math.sin(a),-.46,-x*math.sin(a)+z*math.cos(a)),(1.7,.03,15));o.rotation_euler.z=a
            for x in [-24,0,24]:
                for z in range(76,195,14):
                    o=paint('Lane',(.26,.36,.49),(x*math.cos(a)+z*math.sin(a),-.46,-x*math.sin(a)+z*math.cos(a)),(.6,.03,7));o.rotation_euler.z=a
            for j in range(8):
                x=-125+j*35;z=188;linked('City_Furniture_desktop',(x*math.cos(a)+z*math.sin(a),0,-x*math.sin(a)+z*math.cos(a)),(1,1,1),a)
        # Painted pools echo the runtime's atlas-colored wet sheen, without reflections.
        for i in range(24):
            a=i*2.399;r=155+i%4*10;paint('Wet_Pool_'+str(i%3),[(.032,.115,.16),(.13,.036,.11),(.08,.07,.18)][i%3],(math.cos(a)*r,-.44,math.sin(a)*r),(8,.02,18)).rotation_euler.z=a
    for o in review.objects:o.hide_render=False
    s.render.resolution_x=1200;s.render.resolution_y=800
    # Reposition the review lights for the full-scale assembly rather than the small kit gallery.
    for name,pos in [('Key',(-280,-300,420)),('Fill',(360,-100,340)),('Rim',(0,360,400))]:
        o=bpy.data.objects.get(s.name+'_'+name);o.location=pos;o.data.energy=1500000 if name=='Key' else 1000000;o.data.size=220;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    cam=s.camera;positions={'front':(0,-850,480),'three-quarter':(600,-760,650),'side':(850,0,480),'rear':(0,850,480)};cam.location=positions[angle];cam.rotation_euler=(Vector((0,0,15))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=740;cam.data.clip_end=3000
    s.render.filepath=BASE+'/assets/shibuya/v177/renders/city-'+angle+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
def render_fist(angle):
    s=bpy.data.scenes['Pomu_Gear5'];col=studio(s);bpy.context.window.scene=s
    for o in s.objects:o.hide_render=o.name not in col.objects
    coil=bpy.data.objects.get('Pomu_Gear5_Coil_Study')
    if coil:coil.hide_render=True
    for o in bpy.data.objects['PomuHakiFist_desktop'].children:o.hide_render=False
    positions={'front':(0,-5,1.7),'three-quarter':(3.4,-4,2.6),'side':(5,0,1.2),'rear':(0,5,1.5)}
    cam=s.camera;cam.location=positions[angle];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=2.2
    s.render.filepath=BASE+'/assets/pomu-gear5/v177/renders/fist-'+angle+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
def export_asset(kind):
    scene='Living_Shibuya' if kind=='city' else 'Pomu_Gear5';s=bpy.data.scenes[scene];bpy.context.window.scene=s
    folder='/assets/shibuya/v177' if kind=='city' else '/assets/pomu-gear5/v177'
    name='city-kit' if kind=='city' else 'pomu-ultimate';prefix='Living_Shibuya_' if kind=='city' else 'Pomu_Gear5_'
    stats=[]
    for profile in ['desktop','mobile']:
        col=bpy.data.collections[prefix+profile];col.hide_viewport=False;col.hide_render=False
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:
            o.hide_set(False);o.select_set(True)
            if o.type!='MESH':continue
            assert not o.modifiers and o.location.length<1e-7 and (o.scale-Vector((1,1,1))).length<1e-7
            assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
            assert all(math.isfinite(c) for v in o.data.vertices for c in v.normal)
        props=bpy.ops.export_scene.gltf.get_rna_type().properties
        assert 'ACTIVE' in [i.identifier for i in props['export_vertex_color'].enum_items]
        assert 'AUTO' in [i.identifier for i in props['export_image_format'].enum_items]
        bpy.ops.export_scene.gltf(filepath=BASE+folder+'/'+name+'-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_image_format='AUTO')
        stats.append({'profile':profile,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')})
        col.hide_viewport=profile=='mobile'
    s['exportStats']=json.dumps(stats);bpy.ops.wm.save_as_mainfile(filepath=BASE+folder+'/'+('living-shibuya-editable' if kind=='city' else 'pomu-gear5-editable')+'.blend');print(json.dumps(stats))
