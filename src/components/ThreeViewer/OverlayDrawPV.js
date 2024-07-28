import React from "react"
import Footer from "./Footer"

export default function OverlayDrawPV({
  visiblePVSystems,
  setvisiblePVSystems,
}) {
  const handleButtonClick = () => {
    const nextIndex = visiblePVSystems.length
    setvisiblePVSystems([...visiblePVSystems, nextIndex])
  }

  return (
    <div className="overlay">
      <div className="overlay-buttons">
        <button onClick={handleButtonClick}>PV-Anlage erstellen</button>
      </div>
    </div>
  )
}
