"""Run in the inspected, task-owned Blender MCP scene. Never replaces old assets.

UV-painted directional clumps, not strand geometry. All non-hair meshes are
copies of the existing GLBs. The untouched factory scene is retained.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi, exp

BASE = 'C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT = BASE + '/assets/roster/hair-review'
CHARACTERS = {'Kitsu':'ember', 'Kairo':'nova', 'Pomu':'cloud', 'Shiro':'eclipse'}

def B(p): return (p[0], -p[2], p[1])
def linear(c): return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
def color(h): return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def enum_value(owner, key, desired):
    valid = [i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if desired not in valid: raise RuntimeError((key,desired,valid))
    return desired

def image_texture(name, profile):
    size = 512 if profile == 'desktop' else 256
    image = bpy.data.images.new(name+'_Directional_Hair_'+profile, width=size, height=size, alpha=False)
    image.colorspace_settings.name = enum_value(image.colorspace_settings, 'name', 'sRGB')
    palette = {'Kitsu':'#ffd04d','Kairo':'#252738','Pomu':'#252432','Shiro':'#e3eafc'}
    base = color(palette[name]); pixels=[]
    # Eight padded swatches. Lines follow a lock's root-to-tip UVs; the dark
    # hair has cool grey highlights, and white hair has pale lavender valleys.
    for y in range(size):
        v = (y % (size//2))/(size//2-1); row=y//(size//2)
        for x in range(size):
            u=(x % (size//4))/(size//4-1); tile=x//(size//4)+4*row
            q=(u-.035)/.93; t=max(0,min(1,(v-.025)/.95))
            phase=tile*.83
            # A broad, broken brush highlight stays legible at game size.
            center=.48+.035*sin(t*3.7+phase)
            lit=exp(-((q-center)/.18)**2)*(.50+.50*sin(pi*t)**.6)
            root=.12*(1-t)**2
            stroke=0
            for k,at in enumerate([.26,.39,.60,.72]):
                curve=at+.018*sin(t*4.3+phase+k*.9)
                fade=sin(pi*max(0,min(1,(t-.04)/.94)))**.6
                stroke += exp(-((q-curve)/(.007 if k%2 else .012))**2)*fade*(.025 if k%2 else -.042)
            # Fine grain is deterministic and low contrast; no glitter/noise.
            grain=.004*sin(q*219+t*7+tile)*sin(q*101-t*3)
            if name in ('Kairo','Pomu'):
                gain=1-root+.26*lit+stroke+grain
                c=tuple(max(0,min(1,b*gain + lit*d)) for b,d in zip(base,(.020,.024,.036)))
            elif name=='Shiro':
                gain=1-.075*(1-t)**2+.022*lit+stroke*.85+grain*.35
                c=tuple(max(0,min(1,b*gain)) for b in base)
            else:
                gain=1-root+.052*lit+stroke*.8+grain
                c=tuple(max(0,min(1,b*gain)) for b in base)
            pixels.extend((*c,1))
    image.pixels.foreach_set(pixels); image.update()
    image.filepath_raw=OUT+'/'+name.lower()+'/textures/'+name.lower()+'-hair-'+profile+'.png'
    image.file_format=enum_value(image,'file_format','PNG');image.save();image.pack()
    mat=bpy.data.materials.new(name+'_Hair_Textured_'+profile);mat.use_nodes=True;mat.diffuse_color=tuple(linear(c) for c in base)+(1,)
    node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(1,1,1,1);node.inputs['Roughness'].default_value=.88
    node.inputs['Specular IOR Level'].default_value=.12
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='HairFlow'
    mat.node_tree.links.new(uv.outputs[0],tex.inputs[0]);mat.node_tree.links.new(tex.outputs['Color'],node.inputs['Base Color'])
    mat['texturePurpose']='Painted lock grain, root shading and restrained brush highlights'
    return mat

def lock_specs(name):
    # base, tip, half-width, depth, outward normal, sweep. Authored individually.
    if name=='Kitsu':
        return [
          ((-.52,2.14,.23),(-.85,2.65,.02),.25,.13,(0,0,1),(-.12,.08,.07)),
          ((-.24,2.21,.08),(-.27,2.60,-.20),.22,.13,(0,0,1),(-.07,.10,.03)),
          ((.10,2.20,.03),(.28,2.67,-.04),.24,.14,(0,0,1),(.04,.09,.04)),
          ((.45,2.13,.06),(.84,2.51,-.03),.24,.12,(0,0,1),(.11,.03,.07)),
          ((-.74,1.98,.12),(-1.22,2.27,.02),.23,.12,(0,0,1),(-.10,.05,.03)),
          ((.73,2.00,.10),(1.22,2.30,.04),.23,.12,(0,0,1),(.12,.06,.04)),
          ((-.64,2.08,.48),(-.80,1.87,.57),.17,.10,(0,0,1),(-.04,-.02,.02)),
          ((-.38,2.16,.55),(-.32,1.85,.74),.18,.11,(0,0,1),(.02,-.05,.03)),
          ((-.10,2.18,.59),(.04,1.93,.77),.17,.105,(0,0,1),(.07,-.04,.03)),
          ((.18,2.18,.57),(.36,1.87,.72),.18,.105,(0,0,1),(.05,-.025,.03)),
          ((.45,2.10,.51),(.72,1.87,.59),.18,.10,(0,0,1),(.035,-.03,.03)),
          ((-.69,1.91,-.25),(-1.10,1.99,-.52),.21,.11,(-1,0,0),(-.06,.025,-.04)),
          ((.69,1.91,-.25),(1.10,1.98,-.54),.21,.11,(1,0,0),(.06,.025,-.04)),
          ((-.35,2.07,-.55),(-.70,2.28,-.98),.24,.12,(0,0,-1),(-.04,.055,-.02)),
          ((.13,2.16,-.54),(.25,2.49,-.92),.25,.13,(0,0,-1),(.08,.04,-.05)),
          ((.48,2.01,-.51),(.76,2.12,-.96),.24,.12,(0,0,-1),(.045,.01,-.07)),
          ((-.46,1.61,-.68),(-.61,1.13,-.77),.19,.10,(0,0,-1),(-.05,-.035,-.04)),
          ((0,1.63,-.81),(.08,1.01,-.86),.22,.105,(0,0,-1),(.035,-.05,-.07)),
          ((.40,1.62,-.69),(.61,1.12,-.77),.20,.10,(0,0,-1),(.035,-.04,-.04)),
          ((-.78,1.66,.025),(-.86,1.18,.02),.065,.035,(-1,0,0),(-.025,0,0)),
          ((.78,1.66,.025),(.86,1.18,.02),.065,.035,(1,0,0),(.025,0,0)),
          ((-.40,2.19,.48),(-.57,2.45,.49),.115,.07,(0,0,1),(-.05,.025,.025)),
          ((.29,2.21,.45),(.54,2.43,.42),.115,.07,(0,0,1),(.065,.02,.025)),
          ((-.78,2.01,.32),(-.99,2.20,.33),.125,.07,(0,0,1),(-.04,.02,.025)),
          ((.77,2.02,.31),(.98,2.16,.29),.12,.07,(0,0,1),(.055,.015,.025)),
          ((-.28,1.93,-.74),(-.41,1.59,-.88),.135,.075,(0,0,-1),(-.035,-.015,-.03)),
          ((.27,1.94,-.73),(.43,1.63,-.86),.135,.075,(0,0,-1),(.045,-.015,-.03))]
    if name=='Pomu':
        return [
          ((-.62,1.86,.43),(-.71,1.54,.59),.16,.085,(0,0,1),(-.045,-.015,.035)),
          ((-.42,1.88,.58),(-.39,1.52,.75),.17,.09,(0,0,1),(-.015,-.02,.025)),
          ((-.20,1.88,.65),(-.16,1.61,.78),.145,.085,(0,0,1),(.015,-.025,.035)),
          ((.02,1.87,.67),(.10,1.53,.80),.16,.09,(0,0,1),(.03,-.02,.035)),
          ((.27,1.88,.62),(.38,1.57,.72),.16,.09,(0,0,1),(.025,-.025,.035)),
          ((.49,1.87,.50),(.65,1.54,.57),.16,.085,(0,0,1),(.04,-.02,.025)),
          ((-.72,1.75,.22),(-.88,1.33,.25),.15,.075,(-1,0,0),(-.04,-.035,.02)),
          ((.72,1.75,.22),(.87,1.37,.25),.15,.075,(1,0,0),(.04,-.025,.02)),
          ((-.74,1.63,-.10),(-.96,1.28,-.24),.15,.07,(-1,0,0),(-.055,-.03,-.035)),
          ((.74,1.63,-.10),(.95,1.30,-.23),.15,.07,(1,0,0),(.05,-.03,-.03)),
          ((-.58,1.56,-.47),(-.68,1.17,-.61),.18,.09,(0,0,-1),(-.035,-.03,-.035)),
          ((-.28,1.59,-.76),(-.23,1.08,-.87),.19,.09,(0,0,-1),(.035,-.05,-.03)),
          ((.06,1.59,-.80),(.12,1.11,-.89),.18,.09,(0,0,-1),(.02,-.035,-.04)),
          ((.38,1.58,-.61),(.57,1.15,-.69),.18,.085,(0,0,-1),(.035,-.03,-.045)),
          ((-.51,1.80,-.54),(-.80,1.50,-.65),.16,.085,(0,0,-1),(-.04,-.02,-.04)),
          ((.49,1.80,-.54),(.80,1.52,-.65),.16,.085,(0,0,-1),(.04,-.02,-.04)),
          ((-.15,1.80,-.74),(-.12,1.44,-.84),.16,.085,(0,0,-1),(-.02,-.01,-.03)),
          ((.17,1.82,-.72),(.37,1.46,-.81),.16,.085,(0,0,-1),(.05,-.02,-.03)),
          ((-.56,1.78,.59),(-.53,1.58,.72),.080,.065,(0,0,1),(.035,-.015,.025)),
          ((.04,1.78,.76),(-.02,1.61,.81),.080,.06,(0,0,1),(-.035,-.01,.02)),
          ((.42,1.78,.64),(.47,1.63,.70),.070,.06,(0,0,1),(.01,-.02,.02)),
          ((-.30,1.82,.70),(-.29,1.61,.80),.065,.045,(0,0,1),(.01,-.025,.02)),
          ((.28,1.81,.71),(.23,1.63,.79),.065,.045,(0,0,1),(-.01,-.02,.025)),
          ((-.43,1.69,-.66),(-.41,1.35,-.80),.08,.05,(0,0,-1),(.01,-.015,-.025)),
          ((.27,1.68,-.70),(.35,1.36,-.82),.08,.05,(0,0,-1),(.025,-.02,-.025))]
    if name=='Kairo':
        specs=[
          ((-.51,2.17,.28),(-.76,2.63,.09),.25,.13,(0,0,1),(-.12,.065,.05)),
          ((-.22,2.29,.04),(-.37,2.79,-.09),.25,.13,(0,0,1),(-.11,.07,.055)),
          ((.12,2.29,.03),(.31,2.69,-.18),.24,.13,(0,0,1),(.055,.065,.03)),
          ((.45,2.17,.12),(.96,2.51,-.01),.23,.12,(0,0,1),(.13,.065,.04)),
          ((-.32,2.04,.54),(-.47,1.62,.75),.23,.13,(0,0,1),(-.055,-.03,.04)),
          ((-.05,2.12,.59),(-.13,1.72,.82),.22,.13,(0,0,1),(-.07,-.015,.055)),
          ((.29,2.08,.54),(.51,1.69,.74),.25,.12,(0,0,1),(.045,-.03,.03)),
          ((-.65,1.97,.25),(-.91,1.60,.31),.19,.09,(-1,0,0),(-.055,-.01,.02)),
          ((.65,1.97,.25),(.91,1.64,.31),.19,.09,(1,0,0),(.065,-.025,.025)),
          ((-.70,2.05,-.10),(-1.16,2.15,-.37),.21,.11,(-1,0,0),(-.075,.065,-.04)),
          ((.70,2.04,-.10),(1.17,2.06,-.48),.22,.11,(1,0,0),(.075,.03,-.06)),
          ((-.48,2.05,-.56),(-.86,2.32,-.88),.24,.13,(0,0,-1),(-.065,.035,-.045)),
          ((-.11,2.22,-.65),(-.15,2.61,-1.0),.26,.13,(0,0,-1),(-.045,.055,-.02)),
          ((.27,2.11,-.61),(.62,2.42,-.96),.24,.13,(0,0,-1),(.055,.045,-.04)),
          ((-.52,1.72,-.55),(-.79,1.46,-.69),.20,.10,(0,0,-1),(-.065,-.02,-.05)),
          ((-.16,1.78,-.72),(-.06,1.34,-.89),.22,.10,(0,0,-1),(.03,-.04,-.05)),
          ((.30,1.73,-.67),(.58,1.47,-.77),.21,.11,(0,0,-1),(.06,-.015,-.04)),
          ((-.61,2.19,.42),(-.92,2.40,.47),.15,.085,(0,0,1),(-.035,.06,.03)),
          ((.54,2.19,.43),(.92,2.33,.37),.15,.085,(0,0,1),(.075,.02,.03)),
          ((-.16,2.13,.67),(-.33,1.91,.85),.105,.065,(0,0,1),(-.04,-.01,.025)),
          ((.38,2.04,.65),(.44,1.82,.79),.095,.06,(0,0,1),(-.015,-.02,.025)),
          ((-.38,2.23,.43),(-.51,2.51,.47),.11,.07,(0,0,1),(-.035,.02,.03)),
          ((.13,2.26,.42),(.37,2.53,.40),.11,.07,(0,0,1),(.055,.025,.025)),
          ((-.25,1.96,-.77),(-.40,1.67,-.91),.105,.065,(0,0,-1),(-.02,-.02,-.03)),
          ((.32,1.93,-.72),(.51,1.68,-.88),.105,.065,(0,0,-1),(.045,-.02,-.03))]
        return specs
    return [
      ((-.49,2.13,.25),(-1.03,2.43,.17),.24,.12,(0,0,1),(-.095,.065,.035)),
      ((-.23,2.26,.06),(-.28,2.65,-.04),.24,.12,(0,0,1),(-.13,.06,.02)),
      ((.09,2.28,.01),(.51,2.60,-.11),.25,.12,(0,0,1),(.12,.035,.02)),
      ((.45,2.13,.13),(1.15,2.28,.05),.24,.115,(0,0,1),(.13,.03,.025)),
      ((-.50,2.02,.46),(-.59,1.65,.68),.20,.10,(0,0,1),(-.055,-.015,.03)),
      ((-.26,2.06,.57),(-.21,1.69,.79),.19,.10,(0,0,1),(.04,-.025,.04)),
      ((0,2.09,.63),(.08,1.64,.83),.18,.10,(0,0,1),(.07,-.015,.045)),
      ((.25,2.08,.57),(.41,1.71,.74),.19,.10,(0,0,1),(.06,-.025,.025)),
      ((.51,2.00,.47),(.77,1.74,.55),.19,.095,(0,0,1),(.06,-.015,.02)),
      ((-.73,1.91,.07),(-.98,1.65,-.10),.17,.095,(-1,0,0),(-.06,-.01,-.035)),
      ((.73,1.91,.07),(.99,1.63,-.17),.17,.095,(1,0,0),(.065,-.035,-.025)),
      ((-.47,2.01,-.56),(-.75,2.24,-.96),.24,.12,(0,0,-1),(-.055,.065,-.035)),
      ((-.10,2.19,-.62),(.01,2.49,-1.03),.26,.12,(0,0,-1),(.08,.035,-.035)),
      ((.31,2.03,-.59),(.79,2.08,-.95),.24,.11,(0,0,-1),(.07,.025,-.05)),
      ((-.51,1.69,-.57),(-.73,1.42,-.64),.18,.095,(0,0,-1),(-.035,-.03,-.04)),
      ((-.14,1.76,-.73),(-.1,1.30,-.9),.21,.10,(0,0,-1),(-.025,-.04,-.05)),
      ((.27,1.71,-.67),(.56,1.41,-.73),.20,.095,(0,0,-1),(.035,-.025,-.04)),
      ((-.57,2.23,.44),(-.88,2.49,.39),.14,.07,(0,0,1),(-.06,.04,.025)),
      ((.23,2.28,.45),(.69,2.47,.38),.16,.085,(0,0,1),(.07,.03,.025)),
      ((-.13,1.97,.74),(-.04,1.77,.86),.085,.055,(0,0,1),(.025,-.015,.015)),
      ((.38,1.95,.65),(.63,1.82,.68),.09,.055,(0,0,1),(.05,-.01,.02)),
      ((-.41,2.20,.42),(-.67,2.43,.46),.11,.065,(0,0,1),(-.06,.03,.025)),
      ((.02,2.24,.46),(.36,2.50,.43),.12,.07,(0,0,1),(.06,.025,.025)),
      ((-.28,1.93,-.76),(-.42,1.65,-.90),.10,.06,(0,0,-1),(-.025,-.015,-.03)),
      ((.34,1.92,-.71),(.53,1.66,-.87),.10,.06,(0,0,-1),(.035,-.02,-.025))]

def build_hair(name, profile, col, parent):
    v=[];f=[];face_uv=[];lock_groups=[]
    def add_face(indices,uv): f.append(tuple(indices));face_uv.append(uv)
    # Compact continuous scalp. Lower edge follows the existing hairline/nape,
    # rather than adding a second giant round volume above the head.
    if name=='Kitsu': levels=[(1.76,.85,.44,-.89),(2.01,.90,.56,-.87),(2.22,.64,.34,-.70),(2.38,.18,-.10,-.33)]
    elif name=='Pomu': levels=[(1.64,.85,.54,-.86),(1.86,.87,.59,-.85),(2.08,.70,.40,-.70),(2.22,.15,-.11,-.34)]
    elif name=='Kairo': levels=[(1.72,.85,.44,-.86),(2.00,.89,.54,-.85),(2.28,.66,.30,-.70),(2.45,.18,-.11,-.34)]
    else: levels=[(1.72,.85,.44,-.86),(1.98,.88,.53,-.85),(2.21,.63,.29,-.70),(2.37,.18,-.11,-.34)]
    N=12 if name=='Kitsu' else 16
    for row,(y,w,front,rear) in enumerate(levels):
        for i in range(N):
            a=2*pi*i/N; drop=(.49 if name=='Pomu' else .65 if name=='Kitsu' else .35)*(1-cos(a))*.5 if row==0 else 0
            edge=.045*sin(a*5+.6)*(1-cos(a))*.5 if row==0 else 0
            v.append((w*sin(a),y-drop+edge,(front+rear)*.5+(front-rear)*.5*cos(a)))
    for row in range(3):
        for i in range(N):
            a=row*N+i;b=row*N+(i+1)%N
            u0=.035+.93*(i%4)/4;u1=.035+.93*((i%4)+1)/4
            uv0=.025+.95*(.13+row*.20);uv1=.025+.95*(.13+(row+1)*.20)
            add_face((a,b,b+N,a+N),[(u0/4,uv0/2),(u1/4,uv0/2),(u1/4,uv1/2),(u0/4,uv1/2)])
    add_face(tuple(reversed(range(N))),[(.03,.03)]*N)
    add_face(tuple(3*N+i for i in range(N)),[(.06,.44)]*N)
    # Six-sided lenticular cross sections give a central ridge and thin edges.
    section=[(-1,0),(-.52,.67),(0,1),(.52,.67),(1,0),(0,-.45)]
    specs=lock_specs(name)
    for lock,(base,tip,width,depth,normal,bend) in enumerate(specs):
        base=Vector(base);tip=Vector(tip);normal=Vector(normal)
        # Embed every root in the continuous scalp, including the small overlay
        # locks. A cap floating above the scalp reads as intersecting blocks.
        y=base.y;j=next((k for k in range(3) if levels[k][0]<=y<=levels[k+1][0]),0 if y<levels[0][0] else 2)
        lo,hi=levels[j],levels[j+1];q=max(0,min(1,(y-lo[0])/(hi[0]-lo[0])))
        w,front,rear=[lo[k]*(1-q)+hi[k]*q for k in (1,2,3)]
        center=(front+rear)*.5;radius=(front-rear)*.5
        if abs(normal.z)>.5:
            edge=math.sqrt(max(0,1-(base.x/max(w,.001))**2))
            if normal.z>0:base.z=min(base.z,center+radius*edge-.065)
            else:base.z=max(base.z,center-radius*edge+.065)
        else:
            edge=w*math.sqrt(max(0,1-((base.z-center)/max(radius,.001))**2))
            base.x=math.copysign(min(abs(base.x),max(0,edge-.05)),base.x)
        axis=(tip-base).normalized()
        normal=(normal-axis*normal.dot(axis)).normalized();across=normal.cross(axis).normalized()
        root=len(v);rings=[]
        ts=[(0,.45),(.43,.62)] if profile=='mobile' or name=='Kitsu' else [(0,.45),(.34,.76),(.68,.25)]
        if name=='Kitsu' and profile=='desktop' and lock in (0,2,4,5,6,7,8,9,10):ts=[(0,.45),(.34,.76),(.68,.25)]
        tile=lock%8;cx=tile%4;cy=tile//4
        def uv(i,t): return ((cx+.035+.93*(i/6))/4,(cy+.025+.95*t)/2)
        for t,scale in ts:
            sweep=Vector(bend);sweep-=axis*sweep.dot(axis)
            center=base+(tip-base)*t+sweep*sin(pi*t);ring=[]
            for a,b in section:
                ring.append(len(v));v.append(tuple(center+across*(a*width*scale)+normal*(b*depth*scale)))
            rings.append(ring)
        add_face(tuple(reversed(rings[0])),[uv(0,0)]*6)
        for j in range(len(rings)-1):
            for i in range(6):
                k=(i+1)%6
                add_face((rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]),[uv(i,ts[j][0]),uv(i+1,ts[j][0]),uv(i+1,ts[j+1][0]),uv(i,ts[j+1][0])])
        apex=len(v);v.append(tuple(tip))
        lock_groups.append((root,apex+1))
        for i in range(6):
            add_face((rings[-1][i],rings[-1][(i+1)%6],apex),[uv(i,ts[-1][0]),uv(i+1,ts[-1][0]),uv(i+.5,1)])
    if name=='Kitsu':
        # Preserve the approved blond brows exactly, including their placement.
        original=next(o for o in bpy.data.collections['Kitsu_Hair_Baseline_Inspection'].objects if o.type=='MESH' and o.get('batch')=='Hair')
        keep=[p for p in original.data.polygons if all(1.40<original.data.vertices[i].co.z<1.55 and original.data.vertices[i].co.y<-.50 for i in p.vertices)]
        remap={}
        for p in keep:
            face=[]
            for i in p.vertices:
                if i not in remap:
                    p0=original.data.vertices[i].co;remap[i]=len(v);v.append((p0.x,p0.z,-p0.y))
                face.append(remap[i])
            add_face(face,[(.16,.37)]*len(face))
    data=bpy.data.meshes.new(name+'_Sculpted_Hair_'+profile);data.from_pydata([B(p) for p in v],[],f);data.update()
    uv_layer=data.uv_layers.new(name='HairFlow')
    for poly,uvs in zip(data.polygons,face_uv):
        for loop,uv in zip(poly.loop_indices,uvs):uv_layer.data[loop].uv=uv
        poly.use_smooth=True
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update();data.set_sharp_from_angle(angle=1.12)
    o=bpy.data.objects.new(name+'_Hair_'+profile,data);col.objects.link(o);o.parent=parent
    group=o.vertex_groups.new(name='Continuous_Fitted_Scalp');group.add(list(range(4*N)),1.0,'REPLACE')
    for i,(start,end) in enumerate(lock_groups):
        group=o.vertex_groups.new(name='Hair_Lock_'+str(i+1).zfill(2));group.add(list(range(start,end)),1.0,'REPLACE')
    if lock_groups[-1][1]<len(v):
        group=o.vertex_groups.new(name='Approved_Blond_Brows');group.add(list(range(lock_groups[-1][1],len(v))),1.0,'REPLACE')
    data.materials.append(image_texture(name,profile));o['batch']='Hair';o['silhouette']=True;o['hairRevision']='layered-textured-review';o['lockCount']=len(specs)
    o['textureResolution']=512 if profile=='desktop' else 256
    o['detailNotes']='Individual swept lenticular locks; root shading and painted directional grain'
    return o

def build_character(name):
    if bpy.data.scenes.get(name+'_Textured_Hair_Review'):raise RuntimeError('Candidate already exists; refine it in place.')
    s=bpy.data.scenes.new(name+'_Textured_Hair_Review');bpy.context.window.scene=s
    studio=bpy.data.collections.new(name+'_Hair_Studio');s.collection.children.link(studio)
    for profile in ['desktop','mobile']:
        before=set(bpy.data.objects)
        path='/public/assets/kitsu/' if name=='Kitsu' else '/assets/roster/candidates/'+name.lower()+'/'
        bpy.ops.import_scene.gltf(filepath=BASE+path+name.lower()+'-head-'+profile+'.glb')
        imported=[o for o in bpy.data.objects if o not in before]
        baseline=bpy.data.collections.new(name+'_Untouched_Head_'+profile);s.collection.children.link(baseline)
        for o in imported:
            for c in list(o.users_collection):c.objects.unlink(o)
            baseline.objects.link(o)
            o.name=name+'_Before_'+profile+'_'+o.name
        candidate=bpy.data.collections.new(name+'_Textured_Hair_'+profile);s.collection.children.link(candidate)
        copies={}
        for o in imported:
            if o.type=='MESH' and o.get('batch')=='Hair':continue
            new=o.copy();new.data=o.data.copy() if o.data else None;candidate.objects.link(new);copies[o]=new
        for source,new in copies.items():
            new.parent=copies.get(source.parent)
            if new.type=='MESH':new.name=name+'_'+new['batch']+'_'+profile;new.modifiers.clear()
            elif 'SculptMount' in source.name:new.name=name+'SculptMount_'+profile
            elif 'EyesPivot' in source.name:new.name=('EyesPivot_' if name=='Kitsu' else name+'EyesPivot_')+profile
            elif source.parent is None:new.name=name+'Head_'+profile
        mount=next(o for o in candidate.objects if o.type=='EMPTY' and 'SculptMount' in o.name)
        root=mount.parent;root['schemaVersion']=1;root['characterId']=CHARACTERS[name];root['candidate']=True;root['hairRevision']='layered-textured-review'
        build_hair(name,profile,candidate,mount)
        baseline.hide_render=True;baseline.hide_viewport=True
        candidate.hide_render=profile!='desktop';candidate.hide_viewport=profile!='desktop'
    # Neutral studio light, no bloom, glossy reflections or special render passes.
    s.world=bpy.data.worlds.new(name+'_Hair_Neutral_World');s.world.use_nodes=True
    bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.76,.80,.87,1);bg.inputs[1].default_value=.55
    for label,pos,power,size in [('Key',(-3,4.5,5),245,4),('Fill',(4,2.8,4),145,4),('Rim',(-1,4,-4),210,3)]:
        d=bpy.data.lights.new(name+'_Hair_'+label,enum_value(bpy.types.Light,'type','AREA'));d.energy=power;d.size=size
        o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);o.rotation_euler=(Vector(B((0,1.5,0)))-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new(name+'_Hair_Review_Camera');c=bpy.data.objects.new(d.name,d);studio.objects.link(c);d.type=enum_value(d,'type','ORTHO');d.ortho_scale=3.35;c.location=B((0,1.55,7));c.rotation_euler=(Vector(B((0,1.55,0)))-c.location).to_track_quat('-Z','Y').to_euler();s.camera=c
    try:s.render.engine='BLENDER_EEVEE'
    except TypeError:pass
    s.render.resolution_x=900;s.render.resolution_y=900;s.render.resolution_percentage=100
    s.render.image_settings.file_format=enum_value(s.render.image_settings,'file_format','PNG');s.render.image_settings.color_mode=enum_value(s.render.image_settings,'color_mode','RGBA');s.render.film_transparent=True
    try:s.view_settings.view_transform='Standard';s.view_settings.look='None'
    except TypeError:pass
    s.view_settings.exposure=-.20;s.eevee.taa_render_samples=64
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective=enum_value(area.spaces.active.region_3d,'view_perspective','CAMERA');area.spaces.active.overlay.show_overlays=False
    print(name,'new hair triangles',[(p,sum(len(f.vertices)-2 for f in next(o for o in bpy.data.collections[name+'_Textured_Hair_'+p].objects if o.type=='MESH' and o.get('batch')=='Hair').data.polygons)) for p in ['desktop','mobile']])
    return s
