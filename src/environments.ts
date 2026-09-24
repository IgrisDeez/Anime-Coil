import * as THREE from "three";
import type { MapId } from "./maps";
import { WorldBuilder } from "./worlds/builder";
import { shibuya } from "./worlds/shibuya";
import { leaf } from "./worlds/leaf";
import { tournament } from "./worlds/tournament";
import { harbor } from "./worlds/harbor";
import { atmosphere } from "./worlds/atmosphere";
import type { DetailProfile, EnvironmentFrame, WorldStats } from "./worlds/types";
export type { EnvironmentFrame, DetailProfile } from "./worlds/types";
export interface Environment {
  group: THREE.Group;
  landmarks: THREE.Group[];
  readonly stats: WorldStats;
  readonly profile: DetailProfile;
  update(frame: EnvironmentFrame): void;
  dispose(): void;
}
const builders = { shibuya, leaf, tournament, harbor };
export function buildEnvironment(id: MapId, profile: DetailProfile = "desktop"): Environment {
  const b = new WorldBuilder(profile);
  try {
    builders[id](b);
    b.finish();
    const animate=atmosphere(b,id);
    let disposed=false;
    const env:Environment={group:b.group,landmarks:b.landmarks,stats:b.stats(b.detail.particles),profile,
      update(frame){if(disposed||frame.paused)return;b.update(frame);for(const motion of b.motions)motion(frame);animate(frame);},
      dispose(){if(disposed)return;disposed=true;b.dispose();}};
    env.update({time:0,dt:0,camera:{x:0,z:0},focus:{x:0,z:0},mode:"menu",paused:false,reducedMotion:false});
    return env;
  } catch(error){b.dispose();throw error;}
}
