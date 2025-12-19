import { Suspense, lazy } from 'react'
import './App.css'

const Snake3DGame = lazy(() =>
  import('./components/Snake3DGame').then((m) => ({ default: m.Snake3DGame })),
)

export default function App() {
  return (
    <div className="appRoot">
      <Suspense fallback={<div className="appLoading">Loading Snake3DGame…</div>}>
        <Snake3DGame />
      </Suspense>
    </div>
  )
}
