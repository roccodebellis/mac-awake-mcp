// Full-screen attention flash across every display.
// Usage: swift flash.swift [count] [r] [g] [b]
// Defaults: 3 flashes, white. Runs in the user's GUI session; exits on its own.
import Cocoa

let args = CommandLine.arguments
func arg(_ i: Int, _ fallback: Double) -> Double {
  return args.count > i ? (Double(args[i]) ?? fallback) : fallback
}

let count = Int(arg(1, 3))
let r = arg(2, 1.0), g = arg(3, 1.0), b = arg(4, 1.0)

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

var windows: [NSWindow] = []
for screen in NSScreen.screens {
  let w = NSWindow(
    contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
  w.isOpaque = false
  w.backgroundColor = NSColor(calibratedRed: r, green: g, blue: b, alpha: 1.0)
  w.alphaValue = 0.0
  w.level = .screenSaver
  w.ignoresMouseEvents = true
  w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
  w.setFrame(screen.frame, display: true)
  w.orderFrontRegardless()
  windows.append(w)
}

func pump(_ seconds: TimeInterval) {
  RunLoop.current.run(until: Date().addingTimeInterval(seconds))
}

for _ in 0..<max(1, count) {
  for w in windows { w.alphaValue = 0.85 }
  pump(0.07)
  for w in windows { w.alphaValue = 0.0 }
  pump(0.11)
}
