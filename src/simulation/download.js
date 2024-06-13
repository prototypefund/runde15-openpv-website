import * as THREE from "three"
import { Matrix4 } from "three";
import { coordinatesXY15, projectToWebMercator } from "./location"
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TILE2METERS = 1222.992452;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
// dracoLoader.setDecoderConfig({ type: "js" }); 
dracoLoader.preload();
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

function getFileNames(lon, lat) {
  let [x, y] = projectToWebMercator(lon, lat)

  const tile_x = Math.floor(x);
  const tile_y = Math.floor(y);

  const downloads = [
    {tile: {x: tile_x  , y: tile_y  }, center: {x, y}},
    {tile: {x: tile_x-1, y: tile_y  }, center: {x, y}},
    {tile: {x: tile_x  , y: tile_y-1}, center: {x, y}},
    {tile: {x: tile_x+1, y: tile_y  }, center: {x, y}},
    {tile: {x: tile_x  , y: tile_y+1}, center: {x, y}},
    {tile: {x: tile_x-1, y: tile_y-1}, center: {x, y}},
    {tile: {x: tile_x-1, y: tile_y+1}, center: {x, y}},
    {tile: {x: tile_x+1, y: tile_y-1}, center: {x, y}},
    {tile: {x: tile_x+1, y: tile_y+1}, center: {x, y}},
  ];
  return downloads;
}

function get_file_names_laz(x, y) {
  const DIVISOR = 1000
  const BUFFER_ZONE = 100
  const loc_utm = projectToUTM32(x, y)
  const x_utm32 = loc_utm[0]
  const y_utm32 = loc_utm[1]

  const x_rounded = Math.floor(x_utm32 / DIVISOR)
  const y_rounded = Math.floor(y_utm32 / DIVISOR)

  const load_tile_left = x_utm32 % DIVISOR < BUFFER_ZONE
  const load_tile_right = x_utm32 % DIVISOR > DIVISOR - BUFFER_ZONE
  const load_tile_lower = y_utm32 % DIVISOR < BUFFER_ZONE
  const load_tile_upper = y_utm32 % DIVISOR > DIVISOR - BUFFER_ZONE

  const file_list = [`${x_rounded}_${y_rounded}.laz`]

  if (load_tile_left) {
    file_list.push(`${x_rounded - 2}_${y_rounded}.laz`)
  }
  if (load_tile_right) {
    file_list.push(`${x_rounded + 2}_${y_rounded}.laz`)
  }
  if (load_tile_lower) {
    file_list.push(`${x_rounded}_${y_rounded - 2}.laz`)
  }
  if (load_tile_upper) {
    file_list.push(`${x_rounded}_${y_rounded + 2}.laz`)
  }
  if (load_tile_left && load_tile_lower) {
    file_list.push(`${x_rounded - 2}_${y_rounded - 2}.laz`)
  }
  if (load_tile_left && load_tile_upper) {
    file_list.push(`${x_rounded - 2}_${y_rounded + 2}.laz`)
  }
  if (load_tile_right && load_tile_lower) {
    file_list.push(`${x_rounded + 2}_${y_rounded - 2}.laz`)
  }
  if (load_tile_right && load_tile_upper) {
    file_list.push(`${x_rounded + 2}_${y_rounded + 2}.laz`)
  }
  return file_list
}

export async function downloadBuildings(loc) {
  const filenames = getFileNames(Number(loc.lon), Number(loc.lat))
  const promises = filenames.map(filename => downloadFile(filename))
  const geometries = await Promise.all(promises);
  console.log(geometries);
  return geometries.flat();
}

async function downloadFile(download_spec) {
  const {tile, center} = download_spec;
  const url = `/germany-mapboxv3-draco/15-${tile.x}-${tile.y}.glb`;
  console.log(url);

  try {
    const data = await gltfLoader.loadAsync(url);
    let geometries = [];
    for(let scene of data.scenes) {
      for(let child of scene.children) {
        let geometry = child.geometry;

        const scale2tile = new Matrix4();
        scale2tile.makeScale(1. / 8192., 1. / 8192., 1.0);
        const translate = new Matrix4();
        translate.makeTranslation(tile.x - center.x, tile.y - center.y, 0.0);
        const scale2meters = new Matrix4();
        // Flip sign of Y axis (in WebMercator, Y+ points down, but we need it to point up)
        scale2meters.makeScale(TILE2METERS, -TILE2METERS, 1.0);

        const tx = scale2tile;
        tx.premultiply(translate);
        tx.premultiply(scale2meters);
        geometry.applyMatrix4(tx);
        geometry = geometry.toNonIndexed();

        geometries.push(geometry);
      }
    }
    return geometries;
  } catch (error) {
    console.warn(error);
    return [];
  }
}

/** Load an OSM map tile and return it as a THREE Mesh
  */
export async function load_map_tile(tx, ty, zoom) {
  console.log(`Loading tile ${tx}, ${ty}@${zoom}`);
  const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
  // const url = `https://a.tile.openstreetmap.fr/hot/${zoom}/${tx}/${ty}.png`;

  const scale = 1 << (zoom - 15);
  const corners = [[tx, ty], [tx+1, ty], [tx, ty+1], [tx+1, ty+1]];
  const vertices = corners.flatMap(([x, y]) => [
    TILE2METERS * (x / scale - coordinatesXY15[0]),
    -TILE2METERS * (y / scale - coordinatesXY15[1]),
    -10.0
  ]);
  const vertexBuffer = new Float32Array(vertices);
  // UV mapping for the texture
  const uvs = new Float32Array([0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0]);
  // Triangle indices
  const indices = new Uint32Array([0, 2, 1, 1, 2, 3]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertexBuffer, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const textureLoader = new THREE.TextureLoader();
  return await new Promise(resolve => {
    textureLoader.load(url, (texture) => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 1,
      });
      resolve(new THREE.Mesh(geometry, material));
    });
  });
}
