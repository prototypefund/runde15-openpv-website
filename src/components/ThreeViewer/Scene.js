import React from "react"
import { Canvas } from "react-three-fiber"

import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js"
import BackgroundMesh from "./BackgroundMesh"
import CustomMapControl from "./CustomMapControl"
import DrawPVControl from "./DrawPVControl"
import SimulationMesh from "./SimulationMesh"
import SurroundingMesh from "./SurroundingMesh"
import Terrain from "./Terrain"

const Scene = ({ simulationMesh, geometries, showTerrain, frontendState }) => {
  console.log("SceneGeoms", geometries)
  console.log("SceneSimulationMesh", simulationMesh)

  return (
    <Canvas>
      <perspectiveCamera fov={45} near={1} far={20000} />
      <ambientLight intensity={2} />
      <directionalLight intensity={2} position={[0, 1, -1]} />
      {geometries.surrounding.length > 0 && (
        <SurroundingMesh
          geometry={BufferGeometryUtils.mergeGeometries(geometries.surrounding)}
        />
      )}
      {geometries.background.length > 0 && (
        <BackgroundMesh
          geometry={BufferGeometryUtils.mergeGeometries(geometries.background)}
        />
      )}
      {simulationMesh != undefined && <SimulationMesh mesh={simulationMesh} />}
      {simulationMesh != undefined && frontendState == "Results" && (
        <CustomMapControl middle={simulationMesh.middle} />
      )}
      {frontendState == "DrawPV" && (
        <DrawPVControl middle={simulationMesh.middle} />
      )}
      {simulationMesh != undefined && showTerrain && <Terrain />}
    </Canvas>
  )
}

export default Scene
