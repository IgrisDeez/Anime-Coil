"""Conform facial features to the skull and refine reference proportions.
Run via live Blender MCP; edits only the named editable Kitsu collection.
The same tessellation functions are used for both export profiles.
"""
import bpy, math
from mathutils import Vector
from math import sin, cos, pi

def face_depth(x,y):
    taper=1-.12*max(0,(1.22-y)/.64)
    return .75*math.sqrt(max(.015,1-(x/(1.05*taper))**2-((y-1.22)/.64)**2))

def replace_mesh(o,v,f,smooth=True):
    o.data.clear_geometry()
    o.data.from_pydata([(x,-z,y) for x,y,z in v],[],f)
    o.data.update()
    for p in o.data.polygons:p.use_smooth=smooth

def oval(o,p,s,n,r,conform=None,chin=False):
    v=[];f=[]
    def point(t,a):
        h=cos(t);x=p[0]+s[0]*sin(t)*cos(a)*(1-.12*max(0,-h) if chin else 1)
        y=p[1]+s[1]*h;z=p[2]+s[2]*sin(t)*sin(a)
        if conform is not None:z=face_depth(x,y)+conform+s[2]*sin(t)*sin(a)
        return (x,y,z)
    v.append(point(0,0))
    for j in range(1,r):
        for i in range(n):v.append(point(pi*j/r,2*pi*i/n))
    bottom=len(v);v.append(point(pi,0))
    for i in range(n):f.append((0,1+(i+1)%n,1+i))
    for j in range(r-2):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    for i in range(n):f.append((bottom,1+(r-2)*n+i,1+(r-2)*n+(i+1)%n))
    replace_mesh(o,v,f)

def leaf(o,base,tip,width,depth,bend=(0,0,0)):
    axis=Vector(tip)-Vector(base);u=Vector((axis.y,-axis.x,0)).normalized();w=Vector((0,0,-1))
    v=[];f=[];n=6
    for j,t in enumerate((0,.23,.52,.78)):
        c=Vector(base)+axis*t+Vector(bend)*sin(pi*t);taper=(.65,1,.72,.34)[j]
        for i in range(n):
            a=2*pi*i/n;v.append(tuple(c+u*cos(a)*width*taper+w*sin(a)*depth*taper))
    v.append(tuple(Vector(tip)));tipindex=len(v)-1
    for j in range(3):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    for i in range(n):f.append((18+i,18+(i+1)%n,tipindex))
    f.append(tuple(reversed(range(n))))
    replace_mesh(o,v,f,True)
    sharp=o.data.attributes.get('sharp_edge') or o.data.attributes.new('sharp_edge','BOOLEAN','EDGE')
    for e in o.data.edges:
        a,b=e.vertices
        sharp.data[e.index].value=(a<24 and b<24 and a%6==b%6)

HAIR={
 'Crown_HighLeft':((-.63,2.13,-.14),(-.96,3.00,-.12),.28,.22,(.04,0,0)),
 'Crown_HighRight':((.65,2.12,-.16),(.98,3.00,-.17),.27,.22,(-.03,0,0)),
 'Crown_CentralSweep':((-.35,2.15,-.32),(.46,2.96,-.31),.37,.24,(0,.05,0)),
 'Crown_BackPeak':((0,2.10,-.60),(-.30,2.91,-.72),.30,.22,(0,0,0)),
 'Crown_CrossSweep':((.11,2.19,.02),(.66,2.77,.04),.34,.22,(0,.05,0)),
 'Front_CenterDiamond':((0,1.94,.64),(0,2.43,.65),.20,.14,(0,0,.02)),
}
for side in (-1,1):
    HAIR['Front_SweptLock_'+str(side)]=((side*.10,1.96,.65),(side*.68,2.43,.65),.28,.19,(side*.04,-.055,.01))
    HAIR['Front_TemplePoint_'+str(side)]=((side*.89,2.28,.45),(side*.93,1.84,.53),.21,.19,(side*.025,0,.01))
    HAIR['Temple_Lock_'+str(side)]=((side*.98,1.76,.06),(side*.98,1.23,.12),.075,.085,(0,0,0))
    specs=((2.17,-.02,1.31,2.48,.04,.24),(2.04,-.04,1.43,2.20,.08,.24),(1.96,-.28,1.29,1.81,-.17,.21),(2.14,-.47,1.29,2.40,-.65,.25),(1.97,-.59,1.27,1.94,-.82,.22))
    for j,(y,z,tx,ty,tz,w) in enumerate(specs):
        HAIR['Swept_Side_'+str(side)+'_'+str(j)]=((side*.80,y,z),(side*tx,ty,tz),w,.20,(0,.03,0))
for j,x in enumerate((-.70,-.37,0,.38,.72)):
    HAIR['Rear_CrownLock_'+str(j)]=((x,2.17,-.65),(x+.12,1.86,-.96),.25,.18,(0,0,0))
    HAIR['Rear_NapeLock_'+str(j)]=((x,1.48,-.92),(x+.07,.62,-.77),.26,.18,(0,0,0))

def corrected_shape(o,name,profile):
    mobile=profile=='mobile';master=profile=='master'
    n=24 if master else 12 if mobile else 18;r=12 if master else 6 if mobile else 8
    side=-1 if '-1' in name else 1
    if name.startswith('Face_'):oval(o,(0,1.22,0),(1.05,.64,.75),32 if master else 18 if mobile else 24,16 if master else 8 if mobile else 10,chin=True)
    elif name.startswith('Eye_OvalWhite_'):oval(o,(side*.43,1.365,0),(.285,.307,.033),n,r,.016)
    elif name.startswith('Eye_DarkPupil_'):oval(o,(side*.43,1.34,0),(.177,.225,.035),n,r,.053)
    elif name.startswith('Eye_SculptedHighlight_'):oval(o,(side*.43-.053,1.43,0),(.05,.061,.012),10,6,.086)
    elif name=='Rear_HairCoverage':oval(o,(0,1.22,-.43),(.96,.60,.43),24 if master else 10 if mobile else 16,12 if master else 6 if mobile else 8)
    elif name=='Rear_Knot':oval(o,(0,1.74,-.97),(.125,.14,.19),16 if master else 10 if mobile else 12,8 if master else 5 if mobile else 6)
    elif name.startswith('Rear_FabricTie_'):
        pts=[(side*.035,1.68,-1.15),(side*.13,1.39,-1.18),(side*.22,1.08,-1.21),(side*.29,.70,-1.23)];v=[];f=[]
        for j,p in enumerate(pts):
            width=(.065,.10,.135,.145)[j]
            for dx,dz in ((-width,-.025),(width,-.025),(width,.025),(-width,.025)):v.append((p[0]+dx,p[1],p[2]+dz))
        for j in range(3):
            for i in range(4):a=j*4+i;b=j*4+(i+1)%4;f.append((a,b,b+4,a+4))
        f.extend([(3,2,1,0),(12,13,14,15)]);replace_mesh(o,v,f)
    elif name=='Nose_Rounded':oval(o,(0,1.13,.755),(.112,.106,.098),12,8)
    elif name.startswith('Ear_ClosedBack_'):oval(o,(side*1.055,1.29,-.06),(.227,.268,.133),12,8)
    elif name.startswith('Ear_Recess_'):
        n=24 if master else 12 if mobile else 16;v=[(side*1.055,1.29,.045)];f=[]
        for radius,z in ((.40,.055),(.65,.16),(.86,.18),(1,-.04)):
            for i in range(n):a=2*pi*i/n;v.append((side*(1.055+.228*radius*cos(a)),1.29+.27*radius*sin(a),z))
        for i in range(n):f.append((0,1+i,1+(i+1)%n))
        for j in range(3):
            for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        if side<0:f=[tuple(reversed(face)) for face in f]
        replace_mesh(o,v,f)
    elif name.startswith('Raised_CheekMark_'):
        j=int(name[-1]);oval(o,(side*.78,1.10-j*.12,0),(.108,.031,.024),12 if master else 8 if mobile else 10,6 if master else 4,.015)
    elif name=='Smile_Curved':
        pts=[(.15*cos(pi*t/12),.918-.040*sin(pi*t/12),0) for t in range(13)];v=[];f=[];n=6
        for j,(x,y,z) in enumerate(pts):
            for i in range(n):a=2*pi*i/n;xx=x+.012*cos(a);yy=y+.012*sin(a);v.append((xx,yy,face_depth(xx,yy)+.008+.011*sin(a)))
        for j in range(12):
            for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        f.extend([tuple(reversed(range(n))),tuple(72+i for i in range(n))]);replace_mesh(o,v,f)
    elif name in HAIR:leaf(o,*HAIR[name])
    else:return False
    if name.startswith('Ear_'):
        a=side*.48
        for vert in o.data.vertices:
            dx=vert.co.x-side*1.055;dz=-vert.co.y+.04
            vert.co.x=side*1.055+dx*cos(a)+dz*sin(a)
            vert.co.y=-(-.04-dx*sin(a)+dz*cos(a))
    return True

col=bpy.data.collections['Kitsu_169_Editable_Master']
bpy.data.objects['KitsuHead'].location.z=.12
for o in col.objects:
    if o.type=='MESH':corrected_shape(o,o.name,'master')
for name,color in [('Skin',(1,.53,.34,1)),('Hair',(1,.48,.025,1)),('CheekMarks',(.81,.20,.12,1))]:
    m=bpy.data.materials['Kitsu_'+name];m.diffuse_color=color
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs[0].default_value=color
bpy.context.scene.camera.location=(0,-7,1.68)
bpy.context.scene.camera.rotation_euler=(Vector((0,0,1.68))-bpy.context.scene.camera.location).to_track_quat('-Z','Y').to_euler()
print('Revised editable face, fitted eyes, ears, cheek marks, mouth and swept hair.')










