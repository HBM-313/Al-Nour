import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "@/components/error-boundary"

// Ydre sikkerhedsnet: fanger fejl der undslipper alle indre boundaries
// (fx før en profil/aldersskind er kendt). Ingen snævrere sted at vende
// tilbage til her, så "skin" er en neutral standard — se
// features/lektion/LessonScreen.tsx for de spil-specifikke boundaries,
// som altid kender barnets rigtige aldersskind.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="app" skin="mid" component="AppRoot">
      <App />
    </ErrorBoundary>
  </StrictMode>
)
