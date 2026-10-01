# Inserted ahead of export_kitsu.py when executing through Blender MCP.
import bpy, math
from math import sin,cos,pi
def profile_shape(o,source,profile):
 name=source.name;mobile=profile=='mobile';n=12 if mobile else 16;r=8
 p=None;s=None
 if name.startswith('Face_'):p=(0,1.18,0);s=(1.02,.6478,.79);n=20 if mobile else 24;r=10 if mobile else 12
 elif name.startswith('Eye_OvalWhite_'):p=(-.39 if '-1' in name else .39,1.28,.697);s=(.294,.352,.115);n=14 if mobile else 16
 elif name.startswith('Eye_DarkPupil_'):p=(-.39 if '-1' in name else .39,1.255,.807);s=(.18,.25,.059);n=14 if mobile else 16
 elif name.startswith('Eye_SculptedHighlight_'):p=(-.35 if '-1' in name else .35,1.36,.866);s=(.053,.065,.022);n=8 if mobile else 10;r=6
 elif name=='Nose_Rounded':p=(0,1.04,.79);s=(.113,.115,.115);n=10 if mobile else 12;r=6 if mobile else 8
 elif name.startswith('Ear_ClosedBack_'):p=(-1.015 if '-1' in name else 1.015,1.07,-.005);s=(.25,.295,.15);n=10 if mobile else 12;r=6 if mobile else 8
 elif name.startswith('Rear_Knot'):p=(0,1.64,-.91);s=(.14,.16,.11);n=10 if mobile else 12;r=6 if mobile else 8
 elif name.startswith('Plate_Rivet'):
  b=[v.co for v in source.data.vertices];p=((min(v.x for v in b)+max(v.x for v in b))/2,(min(v.z for v in b)+max(v.z for v in b))/2,-(min(v.y for v in b)+max(v.y for v in b))/2);s=(.026,.026,.012);n=8;r=4
 elif name.startswith('Raised_CheekMark'):
  side=-1 if '-1_' in name else 1;j=int(name[-1]);p=(side*.73,.99-j*.125,0);s=(.11,.032,.025);n=10 if mobile else 12;r=4 if mobile else 6
 if p:
  v=[];f=[]
  def point(t,a):
   x=p[0]+s[0]*sin(t)*cos(a);y=p[1]+s[1]*cos(t);z=p[2]+s[2]*sin(t)*sin(a)
   if name.startswith('Face_'):x*=1-.15*max(0,-cos(t))
   if name.startswith('Raised_CheekMark'):z=.79*math.sqrt(max(.01,1-(x/1.01)**2-((y-1.18)/.648)**2))+.035+s[2]*sin(t)*sin(a)
   return (x,-z,y)
  v.append(point(0,0))
  for j in range(1,r):
   for i in range(n):v.append(point(pi*j/r,2*pi*i/n))
  bottom=len(v);v.append(point(pi,0))
  for i in range(n):f.append((0,1+(i+1)%n,1+i))
  for j in range(r-2):
   for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
  for i in range(n):f.append((bottom,1+(r-2)*n+i,1+(r-2)*n+(i+1)%n))
  o.data.clear_geometry();o.data.from_pydata(v,[],f);o.data.update()
  for poly in o.data.polygons:poly.use_smooth=True
  return True
 if name.startswith('Ear_Recess_'):
  side=-1 if '-1' in name else 1;n=12 if mobile else 16;v=[(side*1.015,-.08,1.07)];f=[]
  for radius,z in ((.42,.095),(.64,.21),(.86,.23),(1,0)):
   for i in range(n):a=2*pi*i/n;v.append((side*(1.015+.255*radius*cos(a)),-z,1.07+.30*radius*sin(a)))
  for i in range(n):f.append((0,1+i,1+(i+1)%n))
  for j in range(3):
   for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
  # Author both ears with front-facing bowl normals.
  if side<0:f=[tuple(reversed(face)) for face in f]
  o.data.clear_geometry();o.data.from_pydata(v,[],f);o.data.update()
  for poly in o.data.polygons:poly.use_smooth=True
  return True
 # Silhouette tips, smile and emblem retain their authored sections.
 if name=='Smile_Curved' or name.startswith('Diagonal_') or name.startswith('Rear_FabricTie'):
  return True
 return False
