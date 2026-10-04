import bpy,bmesh,math,json
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
def B(p):return (p[0],-p[2],p[1])
def enum_value(owner,key,wanted):
    values=[i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if wanted not in values:raise ValueError((key,wanted,values))
    return wanted
def export_dense_city():
    s=bpy.data.scenes['Dense_Shibuya_V178'];bpy.context.window.scene=s;stats=[]
    for profile in ['desktop','mobile']:
        col=bpy.data.collections['Dense_Shibuya_'+profile];col.hide_viewport=False;col.hide_render=False
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:o.hide_set(False);o.select_set(True)
        props=bpy.ops.export_scene.gltf.get_rna_type().properties
        for key,val in [('export_vertex_color','ACTIVE'),('export_image_format','AUTO')]:
            assert val in [i.identifier for i in props[key].enum_items]
        bpy.ops.export_scene.gltf(filepath=BASE+'/assets/shibuya/v178/city-kit-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_image_format='AUTO')
        stats.append({'profile':profile,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')})
    bpy.ops.wm.save_as_mainfile(filepath=BASE+'/assets/shibuya/v178/dense-shibuya-editable.blend')
    print(json.dumps(stats))
def studio(s,large=False):
    bpy.context.window.scene=s
    col=bpy.data.collections.get(s.name+'_Studio')
    if col:return col
    col=bpy.data.collections.new(s.name+'_Studio');s.collection.children.link(col)
    try:s.render.engine='CYCLES'
    except TypeError:pass
    s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=1200 if large else 760;s.render.resolution_y=800 if large else 760;s.render.resolution_percentage=100
    s.render.image_settings.file_format=enum_value(s.render.image_settings,'file_format','PNG')
    try:s.view_settings.view_transform='Standard'
    except TypeError:pass
    s.world=bpy.data.worlds.new(s.name+'_World');s.world.use_nodes=True
    bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.08,.12,.20,1);bg.inputs['Strength'].default_value=.50
    cam=bpy.data.cameras.new(s.name+'_Camera');o=bpy.data.objects.new(cam.name,cam);col.objects.link(o);s.camera=o
    for name,position,power,color in [('Key',(-4,-5,7),650,(1,.88,.78)),('Fill',(5,-2,5),450,(.72,.84,1)),('Rim',(0,4,6),700,(.89,.94,1))]:
        light=bpy.data.lights.new(s.name+'_'+name,'AREA');light.energy=power;light.shape=enum_value(light,'shape','DISK');light.size=5;light.color=color
        o=bpy.data.objects.new(light.name,light);col.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,.1))-o.location).to_track_quat('-Z','Y').to_euler()
    return col
def city_gallery(angle='three-quarter'):
    s=bpy.data.scenes['Dense_Shibuya_V178'];col=studio(s,True)
    for o in s.objects:o.hide_render=o.name not in col.objects
    gallery=bpy.data.collections.get('Dense_Shibuya_Gallery_Final')
    if not gallery:
        gallery=bpy.data.collections.new('Dense_Shibuya_Gallery_Final');s.collection.children.link(gallery)
        for i,family in enumerate(['Rounded','Glass','Shop','Terrace','Station','Arcade','Qfront','Magnet','Landmark109','StationTower','Hotel','Civic','RoofGarden','SlantTower']):
            source=bpy.data.objects['City_'+family+'_desktop'];offset=Vector(B(((i%5-2)*25,0,(i//5-1)*35)))
            for child in source.children:
                o=child.copy();o.data=child.data;o.parent=None;o.location=offset;o.hide_render=False;gallery.objects.link(o)
    for o in gallery.objects:o.hide_render=False
    for name,pos,power in [('Key',(-100,-140,150),140000),('Fill',(100,-30,100),90000),('Rim',(0,120,140),160000)]:
        o=bpy.data.objects[s.name+'_'+name];o.location=pos;o.data.energy=power;o.data.size=90;o.rotation_euler=(Vector((0,0,22))-o.location).to_track_quat('-Z','Y').to_euler()
    positions={'front':(0,-220,110),'three-quarter':(160,-220,170),'side':(220,0,140),'rear':(0,220,120)}
    cam=s.camera;cam.location=positions[angle];cam.rotation_euler=(Vector((0,0,20))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=180;cam.data.clip_end=2000
    s.render.filepath=BASE+'/assets/shibuya/v178/renders/kit-'+angle+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)

def render_haki(angle='three-quarter'):
    s=bpy.data.scenes['Pomu_Haki_V178'];col=studio(s)
    for o in s.objects:o.hide_render=o.name not in col.objects
    for o in bpy.data.objects['PomuHakiFist_desktop'].children:
        if o.type=='MESH':o.hide_render=False
    cam=s.camera;positions={'front':(0,-5,1.2),'three-quarter':(3.8,-4,2.6),'side':(5,0,1.2),'rear':(0,5,1.2)}
    cam.location=positions[angle];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type=enum_value(cam.data,'type','ORTHO');cam.data.ortho_scale=1.9
    s.render.filepath=BASE+'/assets/pomu-gear5/v178/renders/fist-'+angle+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
