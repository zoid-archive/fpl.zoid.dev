import Dashboard from './sections/Dashboard'
import { SidePanel } from './sections/SidePanel'

function App() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
      <div className="min-w-0 lg:col-span-3">
        <Dashboard />
      </div>
      <div className="min-w-0 self-start space-y-4 lg:sticky lg:top-6 lg:col-span-1">
        <SidePanel />
      </div>
    </div>
  )
}

export default App
