import {mkdir,writeFile} from 'node:fs/promises';
import {CITY_BLOCKS,CITY_STREETS,CITY_ROAD,CITY_WALK,ROAD_MARKINGS,CITY_FRONTAGES,CITY_JUNCTION} from '../src/worlds/shibuya-layout';
await mkdir('assets/shibuya/v178',{recursive:true});
await writeFile('assets/shibuya/v178/layout.json',JSON.stringify({blocks:CITY_BLOCKS,streets:CITY_STREETS,road:CITY_ROAD,walk:CITY_WALK,markings:ROAD_MARKINGS,frontages:CITY_FRONTAGES,junction:CITY_JUNCTION},null,2));
