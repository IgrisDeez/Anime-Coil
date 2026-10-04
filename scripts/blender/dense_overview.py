import bpy,math,json
from mathutils import Vector,Matrix
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
def B(p):return Vector((p[0],-p[2],p[1]))
def review_mat(name,color,emission=False):
    m=bpy.data.materials.get(name)
    if m:return m
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=.82
    if emission and 'Emission Color' in n.inputs:n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=.8
    return m
def review_box(col,name,game_center,game_size,mat,angle=0):
    x,y,z=game_size;verts=[(sx*x/2,sy*z/2,sz*y/2) for sz in [-1,1] for sy in [-1,1] for sx in [-1,1]]
    faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(mat);o=bpy.data.objects.new(name,d);col.objects.link(o);o.location=B(game_center);o.rotation_euler.z=angle
    return o
def review_path(col,name,points,width,y,mat):
    verts=[];faces=[]
    closed=len(points)>2 and points[0]==points[-1]
    def edge(j,sign):
        prev=points[len(points)-2 if closed and j==0 else max(0,j-1)]
        after=points[1 if closed and j==len(points)-1 else min(len(points)-1,j+1)]
        dx,dz=after[0]-prev[0],after[1]-prev[1];length=math.hypot(dx,dz)
        return B((points[j][0]-dz/length*width/2*sign,y,points[j][1]+dx/length*width/2*sign))
    for i in range(len(points)-1):
        start=len(verts);verts.extend([edge(i,1),edge(i+1,1),edge(i+1,-1),edge(i,-1)]);faces.append(tuple(start+k for k in [0,1,2,3]))
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(mat);o=bpy.data.objects.new(name,d);col.objects.link(o)
def overview_setup(layout):
    s=bpy.data.scenes['Dense_Shibuya_V178'];col=bpy.data.collections.get('Dense_Shibuya_Overview_Final_Lit')
    if col:return col
    col=bpy.data.collections.new('Dense_Shibuya_Overview_Final_Lit');s.collection.children.link(col)
    asphalt=review_mat('Review_Asphalt',(.07,.105,.16));curb=review_mat('Review_Paving',(.17,.21,.28));paint=review_mat('Review_Crosswalk',(.50,.60,.67))
    stone=review_mat('Review_Back_Buildings',(.10,.15,.23));roof=review_mat('Review_Rooftops',(.20,.24,.31));windows=review_mat('Review_Warm_Windows',(.61,.49,.32),True);letters=review_mat('Review_Letters',(.89,.83,.66),True)
    review_box(col,'City_Junction',(0,-.6,0),(1150,.2,1150),curb)
    d=bpy.data.meshes.new('Junction_Surface')
    junction_vertices=[B((x,-.44,z)) for x,z in layout['junction']]
    junction_face=tuple(reversed(range(len(junction_vertices))))
    d.from_pydata(junction_vertices,[],[junction_face]);d.materials.append(asphalt);o=bpy.data.objects.new(d.name,d);col.objects.link(o)
    for street in layout['streets']:review_path(col,street['name']+'_asphalt',street['points'],street['width'],-.36,asphalt)
    review_path(col,'Background_Traffic_Route',layout['road'],16,-.33,asphalt)
    for f in layout['frontages']:
        a=f['rotation'];x=f['x']+math.sin(a)*6;z=f['z']+math.cos(a)*6
        review_box(col,'Front_Sidewalk',(x,-.3,z),(101,.02,9),curb,a)
        review_box(col,'Kerb',(x+math.sin(a)*4.4,-.29,z+math.cos(a)*4.4),(101,.025,.28),paint,a)
    for i,mark in enumerate(layout['markings']):review_box(col,'Paint_'+str(i),(mark['x'],-.25,mark['z']),(mark['width'],.015,mark['length']),paint,mark['angle'])
    for i,block in enumerate(layout['blocks']):
        source=bpy.data.objects['City_'+block['family']+'_desktop'];a=block['rotation']
        scale=Vector((block['width']/18,block['depth']/14,block['height']/source['baseSize'][1]))
        for child in source.children:
            o=child.copy();o.data=child.data;o.parent=None;o.location=B((block['x'],0,block['z']));o.scale=scale;o.rotation_euler.z=a;o.hide_render=False;col.objects.link(o)
        font=bpy.data.curves.new('Shop_Label_'+str(i),'FONT');font.body=block['label'];font.align_x='CENTER';font.size=1.8 if len(font.body)<10 else 1.5;font.extrude=.01;font.materials.append(letters)
        o=bpy.data.objects.new(font.name,font);col.objects.link(o)
        front=block['depth']/2+1.8;y=block['height']*.94 if block['family']=='Landmark109' else block['height']*.84 if block['family']=='Magnet' else 8
        o.location=B((block['x']+math.sin(a)*front,y,block['z']+math.cos(a)*front));o.rotation_euler=(math.pi/2,0,a)
    for section,f in enumerate(layout['frontages']):
        for layer in range(2):
            count=8 if layer else 6
            for i in range(count):
                along=(i-(count-1)/2)*(29 if layer else 25);offset=152 if layer else 84;a=f['rotation'];h=62+(i*17+section*23)%112 if layer else 44+(i*23+section*19)%68
                x=f['x']+along*math.cos(a)-math.sin(a)*offset;z=f['z']-along*math.sin(a)-math.cos(a)*offset;w,d=(27,32) if layer else (22,26)
                family=['Hotel','SlantTower','Glass','RoofGarden','Civic'][(i+section*2+layer)%5]
                if (i%4==2 if layer else i%2==1):
                    source=bpy.data.objects['City_'+family+'_desktop']
                    for child in source.children:
                        o=child.copy();o.data=child.data;o.parent=None;o.location=B((x,0,z));o.scale=(w/18,d/14,h/source['baseSize'][1]);o.rotation_euler.z=a;o.hide_render=False;col.objects.link(o)
                    continue
                variant=(i+section+layer)%3
                if variant==0:
                    review_box(col,'Back_Base',(x,h*.35,z),(w,h*.70,d),stone,a)
                    review_box(col,'Back_Setback',(x-w*.08*math.cos(a)-d*.05*math.sin(a),h*.85,z+w*.08*math.sin(a)-d*.05*math.cos(a)),(w*.72,h*.30,d*.75),stone,a)
                elif variant==1:review_box(col,'Back_Narrow',(x,h/2,z),(w*.82,h,d),stone,a)
                else:
                    review_box(col,'Back_Stepped',(x,h*.39,z),(w,h*.78,d),stone,a)
                    review_box(col,'Back_Crown',(x+w*.17*math.cos(a)-d*.12*math.sin(a),h*.89,z-w*.17*math.sin(a)-d*.12*math.cos(a)),(w*.65,h*.22,d*.72),stone,a)
                review_box(col,'Roof',(x+math.cos(a)*w*.12,h+1.4,z-math.sin(a)*w*.12),(w*.44,2.8,d*.5),roof,a)
                for row in range(3 if layer else 4):
                    for c in range(2 if layer else 3):
                        lx=-w*.30+c*w*.3;lz=d/2+.1
                        review_box(col,'Window',(x+math.cos(a)*lx+math.sin(a)*lz,12+row*(h-16)/(3 if layer else 4),z-math.sin(a)*lx+math.cos(a)*lz),(2.1,4 if layer else 5,.1),windows,a)
    return col
def city_overview(angle='three-quarter'):
    s=bpy.data.scenes['Dense_Shibuya_V178'];studio_col=studio(s,True);col=bpy.data.collections['Dense_Shibuya_Overview_Final_Lit']
    for o in s.objects:o.hide_render=o.name not in studio_col.objects and o.name not in col.objects
    for o in col.objects:o.hide_render=False
    for name,pos,power in [('Key',(-350,-350,450),1400000),('Fill',(350,-100,350),900000),('Rim',(0,350,400),1600000)]:
        o=bpy.data.objects[s.name+'_'+name];o.location=pos;o.data.energy=power;o.data.size=240;o.rotation_euler=(Vector((0,0,40))-o.location).to_track_quat('-Z','Y').to_euler()
    positions={'front':(0,-650,420),'three-quarter':(520,-650,550),'side':(650,0,450),'rear':(0,650,440),'plan':(0,0,1000)}
    cam=s.camera;cam.location=positions[angle];cam.rotation_euler=(Vector((0,0,25))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=720;cam.data.clip_end=2500
    s.render.resolution_x=1200;s.render.resolution_y=900;s.render.filepath=BASE+'/assets/shibuya/v178/renders/city-'+angle+'.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
def punch_study():
    s=bpy.data.scenes['Pomu_Haki_V178'];studio_col=studio(s);col=bpy.data.collections.get('Pomu_Wrist_Contact_Study')
    if not col:
        col=bpy.data.collections.new('Pomu_Wrist_Contact_Study');s.collection.children.link(col)
        source=bpy.data.objects['PomuHakiFist_desktop'];anchor=Vector(source['knuckleContact']);root=bpy.data.objects.new('Contact_Scale_12',None);col.objects.link(root);root.scale=(12,12,12);root.rotation_euler.x=math.pi/2
        root.location=B((22,-.46,0))-root.rotation_euler.to_matrix()@(B(anchor)*12)
        for child in source.children:
            if child.type=='MESH':o=child.copy();o.data=child.data;o.parent=root;o.location=(0,0,0);o.hide_render=False;col.objects.link(o)
        wrist=root.location+root.rotation_euler.to_matrix()@(B(source['wristAnchor'])*12);start=B((0,1.3,0));axis=B((0,-1,0))
        p1=start.lerp(wrist,.24)+B((0,8,0));p2=wrist-axis*max(2,(wrist-start).length*.34)
        curve=bpy.data.curves.new('Authored_Wrist_Connection','CURVE');curve.dimensions='3D';curve.bevel_depth=3.05;curve.bevel_resolution=2
        spline=curve.splines.new('POLY');spline.points.add(48)
        for i,p in enumerate(spline.points):
            t=i/48;u=1-t;p.co=(*(start*u**3+p1*3*u*u*t+p2*3*u*t*t+wrist*t**3),1);p.radius=.23+.77*t
        curve.materials.append(review_mat('Review_Rubber_Arm',(.84,.75,.66)));o=bpy.data.objects.new(curve.name,curve);col.objects.link(o)
        skin=review_mat('Study_Ground',(.16,.20,.27));review_box(col,'Contact_Ground',(12,-.6,0),(50,.2,22),skin)
        # The approved Gear 5 head stays at its original mount, beside the strike study.
        for obj in bpy.data.collections['Pomu_Haki_desktop'].objects:
            if obj.type=='MESH' and obj.name.startswith('PomuGear5'):
                o=obj.copy();o.data=obj.data;world=obj.matrix_world.copy();o.parent=None;o.matrix_world=world;o.hide_render=False;col.objects.link(o)
    for o in s.objects:o.hide_render=o.name not in studio_col.objects and o.name not in col.objects
    for name,pos,power in [('Key',(-20,-40,50),25000),('Fill',(50,-15,35),15000),('Rim',(20,40,50),30000)]:
        o=bpy.data.objects[s.name+'_'+name];o.location=pos;o.data.energy=power;o.data.size=30;o.rotation_euler=(Vector((10,0,12))-o.location).to_track_quat('-Z','Y').to_euler()
    cam=s.camera;cam.location=(60,-65,45);cam.rotation_euler=(Vector((12,0,9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=56
    s.render.resolution_x=1100;s.render.resolution_y=760;s.render.filepath=BASE+'/assets/pomu-gear5/v178/renders/wrist-contact-study.png';bpy.ops.render.render(write_still=True);print(s.render.filepath)
