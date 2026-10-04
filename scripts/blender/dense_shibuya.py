"""Original modular city, authored through the inspected Blender MCP instance.

The factory Scene is preserved. Game coordinates are Y-up, facing +Z; B converts
them for Blender. All profile meshes contain applied positions and vertex colors.
Run definitions plus build_city(profile) in separate MCP calls.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi

BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/shibuya/v178'
FAMILIES=['Rounded','Glass','Shop','Terrace','Station','Arcade']
def B(p):return (p[0],-p[2],p[1])
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (1,3,5))
def enum_value(owner,key,wanted):
    values=[i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if wanted not in values:raise ValueError((key,wanted,values))
    return wanted
def empty(name,col,parent=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;return o
def material(name,glow=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Roughness'].default_value=.9;p.inputs['Specular IOR Level'].default_value=.1
    a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='Color'
    m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
    if glow:
        m.node_tree.links.new(a.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.7
    return m
def collector():return {'v':[],'f':[],'c':[]}
def add(a,points,faces,color):
    n=len(a['v']);a['v'].extend(B(p) for p in points);a['f'].extend(tuple(n+i for i in f) for f in faces);a['c'].extend([rgb(color)]*len(points))
def box(a,x,y,z,w,h,d,color):
    p=[(x+i*w/2,y+j*h/2,z+k*d/2) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    add(a,p,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color)
def round_box(a,x,y,z,w,h,d,r,color,steps=4):
    ring=[]
    for cx,cz,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,pi/2),(-w/2+r,-d/2+r,pi),(w/2-r,-d/2+r,pi*1.5)]:
        for j in range(steps+1):
            t=start+j*pi/2/steps;ring.append((x+cx+r*cos(t),z+cz+r*sin(t)))
    n=len(ring);p=[(px,y+dy,pz) for dy in [-h/2,h/2] for px,pz in ring]
    f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    add(a,p,f,color)
def mesh(name,a,mat,col,parent,batch):
    data=bpy.data.meshes.new(name);data.from_pydata(a['v'],[],a['f']);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    params=data.color_attributes.bl_rna.functions['new'].parameters
    assert 'FLOAT_COLOR' in [i.identifier for i in params['type'].enum_items]
    assert 'POINT' in [i.identifier for i in params['domain'].enum_items]
    paint=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,c in enumerate(a['c']):paint.data[i].color=(*c,1)
    o=bpy.data.objects.new(name,data);col.objects.link(o);o.parent=parent;o.data.materials.append(mat);o['batch']=batch
    return o
"""Dense Shibuya v178. Authored through Blender MCP; unrelated scenes remain intact."""
import bpy,bmesh,math,json
from mathutils import Vector
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/shibuya/v178'
FAMILIES=['Rounded','Glass','Shop','Terrace','Station','Arcade','Qfront','Magnet','Landmark109','StationTower']
def atlas_image(profile):
    size=1024 if profile=='desktop' else 512
    img=bpy.data.images.new('Shibuya_Detail_Atlas_'+profile,width=size,height=size)
    pixels=[0.0]*(size*size*4);tile=size//4
    colors=[(39,54,75),(51,67,84),(68,57,75),(51,66,68)]
    for y in range(size):
        for x in range(size):
            tx=x//tile;ty=y//tile;u=(x%tile)/tile;v=(y%tile)/tile
            base=colors[(tx+ty)%4];fx=(u*3)%1;fy=(v*3)%1
            lit=(int(u*3)+int(v*3)+tx+ty)%4<2
            col=(183,147,102) if lit else (76,107,131)
            if fx<.12 or fx>.92 or fy<.12 or fy>.88:col=base
            elif fy<.17:col=(27,38,55)
            elif abs(fx-.5)<.025:col=(49,66,82)
            elif fy>.75 and tx%2:col=(124,141,151)
            # AC slats / window blinds are baked, never extra draw calls.
            if tx==3 and .24<fx<.77 and .30<fy<.6:col=(103,119,126) if int(fy*75)%3 else (35,49,65)
            grain=((x*13+y*7)%17-8)*.4;idx=(y*size+x)*4
            pixels[idx:idx+4]=[max(0,min(1,(c+grain)/255)) for c in col]+[1.0]
    img.pixels[:]=pixels;img.filepath_raw=OUT+'/facade-atlas-'+profile+'.png';img.file_format=enum_value(img,'file_format','PNG');img.save();img.pack()
    m=bpy.data.materials.new('City_Facade_Atlas_'+profile);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.95;p.inputs['Specular IOR Level'].default_value=.08
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m
def panel(a,x,y,z,w,h,tile=0,side=False):
    points=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
    if side:points=[(z,py,-px) for px,py,_ in points]
    add(a,points,[(0,1,2,3)],'#ffffff')
    col=tile%4;row=tile//4
    a.setdefault('uv',[]).extend([((col+.015)/4,(row+.015)/4),((col+.985)/4,(row+.015)/4),((col+.985)/4,(row+.985)/4),((col+.015)/4,(row+.985)/4)])
def atlas_mesh(name,a,mat,col,parent):
    o=mesh(name,a,mat,col,parent,'Atlas');uv=o.data.uv_layers.new(name='UVMap')
    for loop in o.data.loops:uv.data[loop.index].uv=a['uv'][loop.vertex_index]
    return o
def build_dense_city(profile):
    s=bpy.data.scenes.get('Dense_Shibuya_V178') or bpy.data.scenes.new('Dense_Shibuya_V178');bpy.context.window.scene=s
    legacy=bpy.data.collections.new('Preserved_V177_City_'+profile);s.collection.children.link(legacy)
    bpy.ops.import_scene.gltf(filepath=BASE+'/public/assets/shibuya/city-kit-'+profile+'.glb')
    originals={o.name:o for o in bpy.context.selected_objects}
    for o in list(bpy.context.selected_objects):
        o.name='V177_'+o.name
        for c in list(o.users_collection):c.objects.unlink(o)
        legacy.objects.link(o);o.hide_render=True
    legacy.hide_render=True;legacy.hide_viewport=True
    col=bpy.data.collections.new('Dense_Shibuya_'+profile);s.collection.children.link(col)
    root=empty('ShibuyaKit_'+profile,col);root['schemaVersion']=2;root['familyCount']=len(FAMILIES);root['front']='+Z';root['groundY']=0
    stone=material('Dense_City_Navy_'+profile);windows=material('Dense_City_Windows_'+profile,True);atlas=atlas_image(profile)
    n=3 if profile=='desktop' else 2
    for idx,family in enumerate(FAMILIES):
        g=empty('City_'+family+'_'+profile,col,root);g['family']=family;g['baseSize']=[18,48,14]
        a=collector();e=collector();p=collector();navy=['#34465e','#3c4359','#334e60','#474451'][idx%4];trim='#617085';ink='#142337'
        if family=='Station':g['baseSize']=[18,12,14]
        # Recessed shop windows, piers, threshold, and a fitted awning.
        round_box(a,0,3.7,-.25,18,7.4,13.5,.35,ink,n)
        for x in [-6,-2,2,6]:box(e,x,3.7,6.57,3.45,5.7,.08,'#e2af75' if x!=2 else '#89b8c9')
        for x in [-8,-4,0,4,8]:box(a,x,3.7,6.82,.25,6,.4,trim)
        box(a,0,.28,7.02,18,.5,1.3,trim);box(a,0,7.6,6.9,18.6,.4,2.1,navy)
        box(a,0,7,7.68,17.2,.33,.13,'#52b9c9' if idx%2 else '#be668e')
        if family=='Station':
            for x in [-8,8]:box(a,x,5,0,1.6,10,14,navy)
            box(a,0,10.7,0,18,2,14,navy);box(e,0,9.4,7.13,14,1.4,.10,'#65c3d1')
            panel(p,0,4.5,7.09,13.5,5.5,5)
        else:
            if family in ['Rounded','Landmark109']:
                round_box(a,0,26,-.35,18,36,13.3,4.8 if family=='Landmark109' else 3.0,navy,n)
                for y in range(11,44,5):
                    round_box(e,0,y,-.35,18.05,2.8,13.35,4.8 if family=='Landmark109' else 3,'#819fae',n)
                    round_box(a,0,y+1.5,-.35,18.3,.25,13.5,4.8 if family=='Landmark109' else 3,trim,n)
                round_box(a,0,46,0,17,3,12,4,ink,n);box(e,0,45,6.21,10,2,.05,'#d691ad')
            elif family=='Terrace':
                for y,h,w,d,z in [(16,16,18,13,0),(29,10,14,11,-1),(40,11,10,9,-2)]:
                    box(a,0,y,z,w,h,d,navy);box(a,0,y+h/2,z,w+.4,.4,d+.5,trim)
                    panel(p,0,y,z+d/2+.05,w-1.3,h-1,idx)
                    box(a,0,y+h/2+1.2,z+d/2,w,.12,.13,trim)
                    for x in [-w*.4,0,w*.4]:box(a,x,y+h/2+.65,z+d/2,.12,1.3,.12,trim)
            else:
                box(a,0,26,-.6,17.3,36,12.7,navy);box(a,0,44.4,-.6,18.1,.65,13.5,trim)
                panel(p,0,26,5.82,16,33,idx)
                for x in [-8.7,8.7]:box(a,x,26,5.94,.30,35,.50,trim)
                for y in [12,20,28,36,43]:box(a,0,y,6.13,18,.22,.63,trim)
                # Finished side elevations; shared atlas adds depth at oblique game angles.
                panel(p,0,26,8.72,12.4,32,(idx+4)%16,True)
                if family in ['Glass','StationTower']:
                    for x in [-6,-3,0,3,6]:box(a,x,26,6.02,.16,34,.28,trim)
                if family=='Qfront':
                    box(a,0,29,6.5,16,17,1.2,ink);box(e,0,29,7.15,15.2,16,.08,'#5f8baf')
                    box(a,-6,47,-1,4,5,5,trim)
                elif family in ['Shop','Magnet','Arcade']:
                    for x in [-7.1,6.8]:
                        box(a,x,27,6.4,2.25,27,1.5,ink)
                        for j in range(5):box(e,x,16+j*5.2,7.18,1.85,3.9,.09,['#56bfd0','#c36b97','#dfb177'][(idx+j)%3])
                if family=='StationTower':
                    box(a,0,46,-1,17,3,12,trim);box(a,2,49,-1,13,3,10,navy);box(a,2,51,-1,9,1,8,trim)
                    for x in [-5,5]:box(a,x,45,0,.23,7,.23,trim)
            # Rooftop rails, service volumes, vents and mounted ACs.
            for x in [-8.2,8.2]:box(a,x,45,0,.25,1.5,12,trim)
            box(a,0,45,-6,16,.9,.25,trim);box(a,-3,47,-2,5,4,5,ink)
            for x in [2,5]:box(a,x,45.6,-2,2,1.7,3,'#71828a')
            if profile=='desktop':
                for y in [14,29]:box(a,8.8,y,-2,.5,1.8,2,'#71828a')
                box(a,8.86,25,-3.5,.2,27,.2,trim)
        mesh('City_'+family+'_Stone_'+profile,a,stone,col,g,'Stone')
        mesh('City_'+family+'_Windows_'+profile,e,windows,col,g,'Windows')
        if not p['v']:panel(p,0,3.7,6.63,6.8,5,idx)
        atlas_mesh('City_'+family+'_Atlas_'+profile,p,atlas,col,g)
    s['description']='Ten original detailed architectural families; dense station, shopping and narrow side streets.'
    for prop in ['Meeting','Furniture']:
        original=originals['City_'+prop+'_Stone_'+profile]
        group=empty('City_'+prop+'_'+profile,col,root)
        copy=original.copy();copy.data=original.data.copy();copy.name='City_'+prop+'_Stone_'+profile;copy.parent=group;copy.hide_render=False;copy.hide_set(False);col.objects.link(copy)
        copy.data.materials.clear();copy.data.materials.append(stone);copy['batch']='Stone'
    print(json.dumps({'profile':profile,'families':len(FAMILIES),'triangles':sum(sum(len(q.vertices)-2 for q in o.data.polygons) for o in col.objects if o.type=='MESH')}))
