"""Editable roster candidates, authored via Blender MCP. Y up / +Z forward.
Each character has a separate scene and collection. Unrelated scenes are retained.
Hair grows from a continuous scalp with individually extruded and swept locks.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi, sqrt, exp
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/roster/candidates'
def B(p): return (p[0],-p[2],p[1])
def lin(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgb(h): return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))
def aim(o,p): o.rotation_euler=(Vector(B(p))-o.location).to_track_quat('-Z','Y').to_euler()
def build_roster_character(name,character):
    if bpy.data.scenes.get(name+'_Roster_Review'): raise RuntimeError('Existing candidate preserved; use the refinement script.')
    out=BASE+'/'+name.lower()
    s=bpy.data.scenes.new(name+'_Roster_Review');bpy.context.window.scene=s
    col=bpy.data.collections.new(name+'_Editable_Sculpt');s.collection.children.link(col)
    studio=bpy.data.collections.new(name+'_Studio');s.collection.children.link(studio)
    colors={'Skin':'#ffc5a4','Hair':'#222435' if character!='eclipse' else '#e3eafc','FaceInk':'#48323b','Mouth':'#a25d54','Blush':'#f2b49c','EyeWhites':'#fff6ee','Iris':'#278ebc' if character=='nova' else '#443245','Pupils':'#222431','Highlights':'#ffffff','Fabric':'#36304f','Trim':'#a89bc9','Hat':'#f4ce83','HatBand':'#df5361'}
    M={}
    for key,h in colors.items():
        m=bpy.data.materials.new(name+'_'+key);m.use_nodes=True;m.diffuse_color=(*rgb(h),1)
        n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        n.inputs[0].default_value=m.diffuse_color;n.inputs[2].default_value=.86;n.inputs[14].default_value=.12;M[key]=m
    def empty(label,pos=(0,0,0),parent=None):
        o=bpy.data.objects.new(name+'_'+label,None);col.objects.link(o);o.parent=parent;o.location=B(pos);return o
    root=empty('Master');root['characterId']=character;root['reviewStatus']='AWAITING_VISUAL_APPROVAL';root['coordinateSystem']='Y up, +Z forward'
    mount=empty('SculptMount',(0,.12,0),root)
    eyes=empty('EyesPivot',(0,1.28,0),mount);eyes['previewEye']=True
    def mesh(label,verts,faces,key,parent=None,smooth=True,front=False):
        d=bpy.data.meshes.new(name+'_'+label);d.from_pydata([B(p) for p in verts],[],faces);d.update()
        bm=bmesh.new();bm.from_mesh(d);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        if front and sum(f.normal.dot(Vector(B((0,0,1)))) for f in bm.faces)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        elif all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        bm.to_mesh(d);bm.free();d.update()
        o=bpy.data.objects.new(name+'_'+label,d);col.objects.link(o);o.parent=parent or mount
        if parent==eyes:o.location=B((0,-1.28,0))
        o['batch']=key;o['silhouette']=key in ('Hair','Fabric','Hat');d.materials.append(M[key])
        for p in d.polygons:p.use_smooth=smooth
        return o
    # Rounded depth with flattened temples, a short tapered chin and continuous nose/cheek transitions.
    width={'nova':.82,'cloud':.87,'eclipse':.80}[character]
    contours=[(.48,.14,.27,-.27),(.55,.34,.40,-.36),(.69,.60 if character=='nova' else .64,.59,-.54),(.90,width-.035,.71,-.66),(1.14,width,.74,-.73),(1.42,width,.71,-.77),(1.70,.79,.62,-.73),(1.94,.64,.39,-.62),(2.12,.36,.00,-.38),(2.19,.015,-.20,-.22)]
    def section(y):
        k=next((i for i in range(len(contours)-1) if contours[i][0]<=y<=contours[i+1][0]),len(contours)-2)
        p1,p2=contours[k:k+2];p0=contours[max(0,k-1)];p3=contours[min(len(contours)-1,k+2)];t=max(0,min(1,(y-p1[0])/(p2[0]-p1[0])))
        return tuple(.5*(2*p1[j]+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t*t+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t*t*t) for j in (1,2,3))
    def facez(x,y):
        w,front,rear=section(y);q=min(1,abs(x)/max(.01,w));z=front*sqrt(max(0,1-q**2.35))
        z+=.055*exp(-(x/.10)**2-((y-1.055)/.105)**2)
        for side in (-1,1):z+=.013*exp(-((x-side*.51)/.20)**2-((y-1.0)/.20)**2)
        return z
    v=[];f=[];N=48;rows=36
    for j in range(rows+1):
        y=.48+(2.19-.48)*(1-cos(pi*j/rows))/2;w,front,rear=section(y)
        for i in range(N):
            a=2*pi*i/N;x=w*sin(a);v.append((x,y,facez(x,y) if cos(a)>=0 else abs(rear)*cos(a)))
    for j in range(rows):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
    f.extend([tuple(reversed(range(N))),tuple(rows*N+i for i in range(N))]);mesh('Cohesive_Cheeks_Chin_Nose',v,f,'Skin')
    def patch(label,cx,cy,outline,key,offset=.016,bulge=.012,parent=None,rows=3):
        n=len(outline);v=[(cx,cy,facez(cx,cy)+offset+bulge)];f=[]
        for j in range(1,rows+1):
            q=j/rows
            for x,y in outline:
                xx=cx+(x-cx)*q;yy=cy+(y-cy)*q;v.append((xx,yy,facez(xx,yy)+offset+bulge*(1-q*q)))
        for i in range(n):f.append((0,1+i,1+(i+1)%n))
        for j in range(rows-1):
            for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        return mesh(label,v,f,key,parent,front=True)
    def disk(label,cx,cy,rx,ry,key,offset=.018,bulge=.01,parent=None):
        return patch(label,cx,cy,[(cx+rx*cos(2*pi*i/24),cy+ry*sin(2*pi*i/24)) for i in range(24)],key,offset,bulge,parent)
    def tube(label,points,key,radius=.009,depth=.004,offset=.02,parent=None):
        v=[];f=[];n=6
        for j,(x,y) in enumerate(points):
            before=points[max(0,j-1)];after=points[min(j+1,len(points)-1)];d=Vector((after[0]-before[0],after[1]-before[1],0)).normalized();u=Vector((-d.y,d.x,0));taper=.55 if j in (0,len(points)-1) else 1
            for i in range(n):
                a=2*pi*i/n;xx=x+u.x*cos(a)*radius*taper;yy=y+u.y*cos(a)*radius*taper;v.append((xx,yy,facez(xx,yy)+offset+sin(a)*depth*taper))
        for j in range(len(points)-1):
            for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        f.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))]);return mesh(label,v,f,key,parent)
    for side in (-1,1):
        v=[];f=[];n=24
        for scale,z in [(0,.015),(.45,.015),(.70,.036),(.87,.050),(1,.005),(.8,-.045),(0,-.055)]:
            for i in range(n):a=2*pi*i/n;dy=.16*sin(a)*scale;v.append((side*(.86+.078*cos(a)*scale+.12*dy),1.20+dy,.015+z))
        for j in range(6):
            for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        mesh('Recessed_Ear_'+str(side),v,f,'Skin')
        if character!='eclipse':
            cx=side*.335;rx=.222 if character=='nova' else .230;ry=.164 if character=='nova' else .177
            outline=[]
            for i in range(32):
                a=2*pi*i/32;dx=rx*cos(a);yy=1.28+ry*sin(a)*(1-.14*abs(cos(a)))+.014*side*dx/rx;outline.append((cx+dx,yy))
            patch('Embedded_Almond_White_'+str(side),cx,1.28,outline,'EyeWhites',.012,.025,eyes,4)
            disk('Iris_Rim_'+str(side),cx,1.278,.106,.132,'Pupils',.040,.005,eyes)
            disk('Iris_'+str(side),cx,1.278,.087,.116,'Iris',.047,.006,eyes)
            disk('Small_Pupil_'+str(side),cx,1.278,.043,.062,'Pupils',.058,.005,eyes)
            disk('Sculpted_Glint_'+str(side),cx-.028,1.322,.021,.028,'Highlights',.069,.008,eyes)
            upper=[(cx+rx*cos(pi*j/18),1.28+ry*sin(pi*j/18)*(1-.14*abs(cos(pi*j/18)))+.014*side*cos(pi*j/18)) for j in range(19)]
            tube('Soft_UpperLid_'+str(side),upper,'Skin',.012,.007,.031)
            tube('Upper_Eye_Accent_'+str(side),upper,'Pupils',.005,.003,.035,eyes)
            points=[(side*(.16+.42*j/16),1.522+(.070 if character=='nova' else .01)*j/16+.025*sin(pi*j/16)) for j in range(17)]
            tube('Shaped_Brow_'+str(side),points,'FaceInk',.022 if character=='nova' else .016,.007,.025)
        disk('Soft_Cheek_Tint_'+str(side),side*.565,.96,.10,.035,'Blush',.009,.002)
    if character=='cloud':
        # Open cheerful smile with a restrained crescent of teeth.
        outline=[]
        for j in range(17):q=j/16;x=-.22+.44*q;outline.append((x,.885+.014*sin(pi*q)))
        for j in range(16,-1,-1):q=j/16;x=-.22+.44*q;outline.append((x,.885-.145*sin(pi*q)))
        patch('Cheerful_Smile',0,.822,outline,'Mouth',.015,.005)
        outline=[(-.19+.38*j/16,.884-.039*sin(pi*j/16)) for j in range(17)]+[(.19-.38*j/16,.889) for j in range(17)]
        patch('Smile_Teeth',0,.87,outline,'Mouth',.027,.002)
        tube('Readable_Facial_Scar',[(.45+.18*j/10,1.05-.026*j/10) for j in range(11)],'Mouth',.010,.003,.019)
        for x in (.49,.58):tube('Scar_Stitch_'+str(x),[(x,1.075),(x+.009,1.025)],'Mouth',.008,.003,.021)
        for o in col.objects:
            if o.type!='MESH' or o.get('batch')!='Mouth':continue
            attr=o.data.color_attributes.new(name='FacePaint',type='FLOAT_COLOR',domain='POINT')
            color=rgb('#fff6ee' if 'Smile_Teeth' in o.name else colors['Mouth'])
            for entry in attr.data:entry.color=(*color,1)
            o.data.color_attributes.active_color=attr
        n=next(n for n in M['Mouth'].node_tree.nodes if n.type=='BSDF_PRINCIPLED');vc=M['Mouth'].node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='FacePaint';M['Mouth'].node_tree.links.new(vc.outputs[0],n.inputs[0])
    else:
        tube('Confident_Subtle_Smile',[(-.12+.25*j/16,.833-.025*sin(pi*j/16)+.018*j/16) for j in range(17)],'Mouth',.009,.005,.020)
    # Continuous scalp. A quad is opened and extruded along an authored sweep for each lock.
    if character=='cloud':
        levels=[(1.62,.83,.59,-.72),(1.87,.86,.62,-.77),(2.05,.75,.50,-.70),(2.17,.50,.20,-.53),(2.23,.20,-.09,-.34),(2.25,.012,-.21,-.23)]
        specs={
          (0,21):((-.63,1.53,.65),(-.03,-.02,.015),'Fringe_L1'),(0,22):((-.39,1.55,.76),(-.02,-.02,.04),'Fringe_L2'),(0,23):((-.15,1.60,.79),(.025,0,.055),'Fringe_L3'),
          (0,0):((.12,1.53,.79),(.02,-.01,.04),'Fringe_C'),(0,1):((.36,1.58,.75),(.03,-.02,.045),'Fringe_R1'),(0,2):((.58,1.54,.67),(.02,-.025,.015),'Fringe_R2'),
          (0,3):((.82,1.35,.35),(.025,-.035,.025),'Side_R1'),(0,20):((-.83,1.36,.35),(-.025,-.02,.025),'Side_L1'),
          (0,6):((.90,1.24,-.10),(.06,-.055,0),'Side_R2'),(0,18):((-.90,1.27,-.10),(-.03,-.04,0),'Side_L2'),
          (0,9):((.57,1.11,-.62),(.025,-.03,-.04),'Nape_R'),(0,11):((.18,1.09,-.82),(.03,-.025,-.045),'Nape_RC'),(0,13):((-.24,1.12,-.82),(-.02,-.03,-.03),'Nape_LC'),(0,15):((-.61,1.15,-.64),(-.03,-.03,-.02),'Nape_L'),(1,12):((0,1.68,-.85),(.025,0,-.03),'Rear_Mid')}
    else:
        levels=[(1.72,.83,.47,-.73),(1.96,.88,.57,-.80),(2.18,.78,.42,-.77),(2.38,.52,.15,-.59),(2.49,.23,-.09,-.40),(2.53,.012,-.24,-.26)]
        specs={
          (0,21):((-.71,1.53,.59),(-.075,-.06,.02),'Fringe_OuterL'),(0,23):((-.29,1.58,.81),(-.04,-.03,.09),'Fringe_CenterL'),(0,0):((.11,1.68,.79),(.055,-.02,.075),'Fringe_CenterR'),(0,2):((.59,1.64,.68),(.055,-.04,.04),'Fringe_OuterR'),
          (1,21):((-.81,2.84,.25),(-.09,.09,.06),'Crown_LowL'),(2,23):((-.42,2.99,.04),(-.15,.12,.025),'Crown_HighL'),(2,1):((.40,2.91,-.04),(.09,.06,.035),'Crown_HighR'),(1,3):((1.08,2.59,.08),(.10,.065,.025),'Crown_SweptR'),
          (1,6):((1.19,2.07,-.15),(.13,.015,-.035),'Side_R'),(1,18):((-1.18,2.22,-.13),(-.10,.035,-.02),'Side_L'),
          (1,9):((.87,2.12,-.88),(.08,.06,-.06),'Rear_R'),(1,11):((.33,2.45,-1.05),(.09,.04,-.08),'Rear_RC'),(1,14):((-.58,2.36,-.98),(-.08,.03,-.06),'Rear_L'),(0,12):((.07,1.33,-.89),(.06,-.04,-.035),'Nape_C'),(0,16):((-.89,1.39,-.50),(-.05,-.03,-.025),'Nape_L')}
        if character=='nova':
            specs={k:((tip[0],1.96+(tip[1]-1.96)*.80 if tip[1]>1.96 else tip[1],tip[2]),bend,label) for k,(tip,bend,label) in specs.items()}
            specs[(1,6)]=((1.15,1.99,-.51),(.12,.03,-.035),'Side_RearSweep_R');specs[(1,18)]=((-1.14,2.10,-.44),(-.10,.04,-.03),'Side_RearSweep_L')
        if character=='eclipse':
            levels=[(1.71,.83,.47,-.73),(1.94,.86,.55,-.79),(2.13,.74,.44,-.73),(2.30,.50,.17,-.57),(2.37,.24,-.07,-.38),(2.39,.012,-.21,-.23)]
            specs={
              (0,22):((-.53,1.59,.71),(-.05,.03,.04),'Fringe_Left'),(0,23):((-.18,1.67,.78),(-.065,.025,.05),'Fringe_MidL'),(0,0):((.10,1.60,.80),(.055,.025,.06),'Fringe_Center'),(0,1):((.38,1.65,.74),(.05,.02,.04),'Fringe_MidR'),(0,3):((.74,1.70,.56),(.06,.02,.025),'Fringe_Right'),
              (1,21):((-1.03,2.42,.16),(-.10,.065,.025),'Crown_LeftFan'),(2,23):((-.26,2.65,.04),(-.12,.05,.015),'Crown_LeaningCenter'),(2,1):((.52,2.58,-.06),(.10,.025,.025),'Crown_RightLayer'),(1,4):((1.15,2.26,.05),(.10,.02,-.015),'Crown_RightFan'),
              (0,6):((.99,1.63,-.16),(.065,-.02,-.025),'Temple_Right'),(0,18):((-.98,1.67,-.09),(-.065,-.025,-.02),'Temple_Left'),
              (1,9):((.79,2.04,-.94),(.04,.015,-.05),'Rear_Right'),(1,12):((.02,2.48,-1.03),(.07,.035,-.05),'Rear_Crown'),(1,15):((-.74,2.22,-.95),(-.05,.04,-.05),'Rear_Left'),(0,12):((-.10,1.30,-.90),(-.04,-.03,-.04),'Soft_Nape')}
    v=[];f=[];N=24
    for row,(y,w,front,rear) in enumerate(levels):
        for i in range(N):
            a=2*pi*i/N;yy=y
            if character=='cloud' and row==0:yy-=.43*(1-cos(a))*.5
            v.append((w*sin(a),yy,(front+rear)/2+(front-rear)/2*cos(a)))
    for row in range(len(levels)-1):
        for i in range(N):
            boundary=[row*N+i,row*N+(i+1)%N,(row+1)*N+(i+1)%N,(row+1)*N+i]
            if (row,i) not in specs:f.append(tuple(boundary));continue
            tip,bend,label=specs[(row,i)];tip=Vector(tip);base=sum((Vector(v[k]) for k in boundary),Vector())/4;last=boundary
            axis=(tip-base).normalized();edge=Vector(v[boundary[1]])-Vector(v[boundary[0]])
            u=(edge-axis*edge.dot(axis)).normalized();w=axis.cross(u).normalized()
            if w.dot(Vector(v[boundary[3]])-Vector(v[boundary[0]]))<0:w=-w
            half_width=edge.length*.55;half_depth=max(.055,min(.14,(Vector(v[boundary[3]])-Vector(v[boundary[0]])).length*.30))
            for t,width_scale in [(.25,1.04),(.55,.72),(.82,.30)]:
                center=base+(tip-base)*t+Vector(bend)*sin(pi*t);ring=[]
                for dx,dz in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                    p=center+u*(dx*half_width*width_scale)+w*(dz*half_depth*width_scale);ring.append(len(v));v.append(tuple(p))
                for k in range(4):kk=(k+1)%4;f.append((last[k],last[kk],ring[kk],ring[k]))
                last=ring
            apex=len(v);v.append(tuple(tip))
            for k in range(4):f.append((last[k],last[(k+1)%4],apex))
    f.extend([tuple(reversed(range(N))),tuple((len(levels)-1)*N+i for i in range(N))])
    hair=mesh('Continuous_Scalp_15_Directional_Locks',v,f,'Hair');hair['lockCount']=15;hair['lockNames']=','.join(x[2] for x in specs.values());hair.data.set_sharp_from_angle(angle=.63)
    def wrap(label,levels,key,segments=64,folds=False):
        v=[];f=[]
        for y,rx,rz in levels:
            for i in range(segments):
                a=i*2*pi/segments;wrinkle=(.008*sin(a*9.)+.005*sin(a*17.))*sin(pi*(y-levels[0][0])/max(.001,levels[-1][0]-levels[0][0])) if folds else 0
                v.append(((rx+wrinkle)*sin(a),y,(rz+wrinkle)*cos(a)))
        for j in range(len(levels)-1):
            for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;f.append((a,b,b+segments,a+segments))
        return mesh(label,v,f,key)
    if character=='cloud':
        # Rounded crown, gently curled brim and subdued woven vertex colours.
        brim=wrap('Straw_Hat_Shaped_Brim',[(2.01,.85,.72),(2.005,1.00,.85),(2.02,1.20,.99),(2.055,1.30,1.07),(2.09,1.28,1.055),(2.075,1.00,.86),(2.075,.85,.72)],'Hat')
        crown=wrap('Straw_Hat_Rounded_Crown',[(2.06,.85,.72),(2.14,.87,.74),(2.36,.80,.68),(2.51,.73,.61),(2.59,.57,.47),(2.625,.23,.19),(2.63,.008,.007)],'Hat')
        wrap('Fitted_Red_Hat_Band',[(2.10,.878,.748),(2.125,.884,.754),(2.225,.855,.727),(2.25,.847,.719)],'HatBand')
        for o in (brim,crown):
            attr=o.data.color_attributes.new(name='StrawWeave',type='FLOAT_COLOR',domain='POINT')
            for vert,entry in zip(o.data.vertices,attr.data):
                x,y,z=vert.co;amount=.89+.10*(.5+.5*sin(math.atan2(x,-y)*64+z*85));entry.color=tuple(c*amount for c in rgb(colors['Hat']))+(1,)
            o.data.color_attributes.active_color=attr
        n=next(n for n in M['Hat'].node_tree.nodes if n.type=='BSDF_PRINCIPLED');vc=M['Hat'].node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='StrawWeave';M['Hat'].node_tree.links.new(vc.outputs[0],n.inputs[0])
    elif character=='eclipse':
        # Thin fitted fabric wraps front, temples and rear; wrinkles stay restrained.
        v=[];f=[];N=64
        for j in range(7):
            q=j/6;y=1.22+q*.39
            for i in range(N):
                a=2*pi*i/N;x=.854*sin(a);side=abs(sin(a));yy=y+.026*side;w,front,rear=section(yy)
                if cos(a)>=0:
                    edge=w*.96;z=facez(x,yy)+.039 if abs(x)<=edge else (facez(edge,yy)+.039)*(1-(abs(x)-edge)/(.854-edge))
                else:z=(abs(rear)+.045)*cos(a)
                z+=.005*sin(a*11+q*2.4)*sin(pi*q);v.append((x,yy,z))
        for j in range(6):
            for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
        band=mesh('Fitted_Blindfold_Restrained_Folds',v,f,'Fabric');band['blindfold']=True
        collar=wrap('Original_Collar_Silhouette',[(.23,.73,.67),(.29,.90,.77),(.42,.98,.80),(.59,.95,.78),(.77,.81,.68),(.87,.65,.53)],'Fabric',48,True)
        for vert in collar.data.vertices:
            x,z,y=vert.co;front=max(0,-z/max(.01,sqrt(x*x+z*z)));vert.co.z-=.17*front*max(0,min(1,(y-.59)/.28))
        trim=tube('Collar_Center_Trim',[(0,.34),(0,.48),(0,.65)],'Trim',.010,.006,.028)
        for vert in trim.data.vertices:vert.co.y=-(.825-max(0,vert.co.z-.42)*.32)
    s.world=bpy.data.worlds.new(name+'_Neutral_World');s.world.use_nodes=True
    bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.76,.80,.87,1);bg.inputs[1].default_value=.55
    for label,pos,power,size in [('Key',(-3,4.5,5),245,4),('Fill',(4,2.8,4),145,4),('Rim',(-1,4,-4),210,3)]:
        d=bpy.data.lights.new(name+'_'+label,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);aim(o,(0,1.5,0))
    d=bpy.data.cameras.new(name+'_Review_Camera');c=bpy.data.objects.new(d.name,d);studio.objects.link(c);d.type='ORTHO';d.ortho_scale=3.35;c.location=B((0,1.55,7));aim(c,(0,1.55,0));s.camera=c
    try:s.render.engine='BLENDER_EEVEE'
    except TypeError:pass
    s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
    try:s.view_settings.view_transform='Standard';s.view_settings.look='None'
    except TypeError:pass
    s.view_settings.exposure=-.20;s.eevee.taa_render_samples=96
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
    bpy.ops.wm.save_as_mainfile(filepath=out+'/'+name.lower()+'-editable.blend')
    print(json.dumps({'character':name,'scene':s.name,'collection':col.name,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH'),'locks':15,'mount':.12,'eyesPivot':1.28}))
    return s
