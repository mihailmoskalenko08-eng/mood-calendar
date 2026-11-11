import UIKit
import Capacitor

/// Главный экран приложения: регистрирует собственный плагин для виджета.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
