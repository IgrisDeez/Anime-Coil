import * as THREE from 'three';
import type { WorldBuilder } from './builder';
import { CITY_ROAD, CITY_WALK, routePose } from './shibuya-layout';

export function shibuyaLife(b:WorldBuilder) {
  const mobile=b.profile==='mobile',people=mobile?20:64,cars=mobile?4:8;
  b.backgroundActors+=people+cars;
  const group=new THREE.Group();group.name='shibuya-background-actors';
  const bodies=new THREE.InstancedMesh(b.geo(new THREE.CapsuleGeometry(.42,.9,3,6)),b.material(new THREE.MeshToonMaterial({color:'white'})),people);
  const heads=new THREE.InstancedMesh(b.geo(new THREE.SphereGeometry(.36,6,5)),b.material(new THREE.MeshToonMaterial({color:'#edc6a8'})),people);
  bodies.name='shibuya-walking-silhouettes';heads.name='shibuya-walking-heads';
  const umbrellas=new THREE.InstancedMesh(b.geo(new THREE.SphereGeometry(1,8,3,0,Math.PI*2,0,Math.PI/2)),bodies.material,people);
  umbrellas.name='shibuya-umbrellas';
  const traffic=new THREE.Group();traffic.name='shibuya-traffic';
  const chassis=new THREE.InstancedMesh(b.geo(new THREE.BoxGeometry(1,1,1)),b.material(new THREE.MeshToonMaterial({color:'white'})),cars);
  const cabins=new THREE.InstancedMesh(chassis.geometry,b.material(new THREE.MeshBasicMaterial({color:'#638599'})),cars);
  const lamps=new THREE.InstancedMesh(chassis.geometry,b.material(new THREE.MeshBasicMaterial({color:'#ffe5ae'})),cars*2);
  const tails=new THREE.InstancedMesh(chassis.geometry,b.material(new THREE.MeshBasicMaterial({color:'#e58b91'})),cars*2);
  const wheels=new THREE.InstancedMesh(chassis.geometry,b.material(new THREE.MeshToonMaterial({color:'#192537'})),cars*4);
  tails.name='city-tail-lights';wheels.name='city-wheels';
  const taxiSigns=new THREE.InstancedMesh(chassis.geometry,lamps.material,cars/2);taxiSigns.name='shibuya-taxi-signs';
  const signalGroup=new THREE.Group();signalGroup.name='shibuya-traffic-signals';
  const signals=new THREE.InstancedMesh(b.geo(new THREE.SphereGeometry(.18,6,4)),cabins.material,8);signals.name='synchronized-traffic-signals';
  const meshes=[bodies,heads,umbrellas,chassis,cabins,lamps,tails,wheels,taxiSigns,signals];
  chassis.name='city-vehicles';cabins.name='city-vehicle-windows';lamps.name='city-headlights';
  const routeRadius=Math.max(...[...CITY_ROAD,...CITY_WALK].map(([x,z])=>Math.hypot(x,z)))+10;
  for(const mesh of meshes){mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(),routeRadius);mesh.frustumCulled=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}
  for(let i=0;i<people;i++){bodies.setColorAt(i,new THREE.Color(['#a685ae','#688c9e','#d4a06e','#759b90'][i%4]));umbrellas.setColorAt(i,new THREE.Color(['#e288b5','#5cb7ca','#deba7d','#7786bf','#78aa99'][i%5]));}
  for(let i=0;i<cars;i++)chassis.setColorAt(i,new THREE.Color(i%2?'#566c8d':'#c4a26a'));
  group.add(bodies,heads,umbrellas);traffic.add(chassis,cabins,lamps,tails,wheels,taxiSigns);signalGroup.add(signals);b.group.add(group,traffic,signalGroup);
  const dummy=new THREE.Object3D(),pose={x:0,z:0,angle:0};
  const update=(time:number,reduced:boolean)=>{
    const t=reduced?0:time;
    const phase=t%16,walk=phase>=12,trafficDistance=(Math.floor(t/16)*12+Math.min(phase,12))*8;
    for(let i=0;i<people;i++){
      const waiting=i>=people*.75;
      routePose(CITY_WALK,waiting?Math.floor((i-people*.75)/4)*310+(i%4)*2.7+(walk?(phase-12)*1.4:0):i*19+t*(i%2?-1:1)*1.4,pose);
      dummy.rotation.set(0,pose.angle+(i%2?Math.PI:0),0);dummy.scale.set(1,1,1);
      dummy.position.set(pose.x,.72+(reduced?0:Math.sin(t*2+i)*.035),pose.z);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
      dummy.position.y+=.87;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);
      dummy.position.y+=.65;dummy.scale.set(1.02,.28,1.02);dummy.updateMatrix();umbrellas.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<cars;i++){
      routePose(CITY_ROAD,i*148+trafficDistance,pose);
      dummy.rotation.set(0,pose.angle,0);dummy.position.set(pose.x,.9,pose.z);dummy.scale.set(2.8,1.5,6);dummy.updateMatrix();chassis.setMatrixAt(i,dummy.matrix);
      dummy.position.y=2;dummy.scale.set(2.5,1.25,3.5);dummy.updateMatrix();cabins.setMatrixAt(i,dummy.matrix);
      if(i%2===0){dummy.position.y=2.78;dummy.scale.set(.8,.33,.5);dummy.updateMatrix();taxiSigns.setMatrixAt(i/2,dummy.matrix);}
      for(let side=0;side<2;side++){
        const lateral=side? .85:-.85;
        dummy.position.set(pose.x+Math.sin(pose.angle)*3.05+Math.cos(pose.angle)*lateral,1,pose.z+Math.cos(pose.angle)*3.05-Math.sin(pose.angle)*lateral);
        dummy.scale.set(.58,.34,.12);dummy.updateMatrix();lamps.setMatrixAt(i*2+side,dummy.matrix);
        dummy.position.set(pose.x-Math.sin(pose.angle)*3.06+Math.cos(pose.angle)*lateral,1,pose.z-Math.cos(pose.angle)*3.06-Math.sin(pose.angle)*lateral);
        dummy.updateMatrix();tails.setMatrixAt(i*2+side,dummy.matrix);
        for(let axle=0;axle<2;axle++){
          const forward=axle?2:-2;
          dummy.position.set(pose.x+Math.sin(pose.angle)*forward+Math.cos(pose.angle)*lateral*1.7,.36,pose.z+Math.cos(pose.angle)*forward-Math.sin(pose.angle)*lateral*1.7);
          dummy.scale.set(.3,.75,1);dummy.updateMatrix();wheels.setMatrixAt(i*4+side*2+axle,dummy.matrix);
        }
      }
    }
    for(let i=0;i<8;i++){
      const [x,z]=CITY_WALK[i];
      dummy.position.set(x,4,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();signals.setMatrixAt(i,dummy.matrix);
      signals.setColorAt(i,new THREE.Color(walk?'#e9849d':'#79d9b8'));
    }
    if(signals.instanceColor)signals.instanceColor.needsUpdate=true;
    for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
  };
  update(0,true);b.moving(group,f=>update(f.time,f.reducedMotion));
  // Register the traffic root without duplicating the update callback.
  b.moving(traffic,()=>{});
  b.moving(signalGroup,()=>{});
}
