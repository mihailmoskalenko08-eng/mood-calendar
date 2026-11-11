# Добавляет в проект Xcode виджет «Оттенков» (WidgetKit) и мост для данных. Запускается только в сборке
# варианта с виджетом (см. .github/workflows/ios.yml), основной проект не меняется.
#   gem install xcodeproj && ruby ios/widget/add-widget.rb

require 'fileutils'
require 'xcodeproj'

root = File.expand_path('..', __dir__) # ios/
app_dir = File.join(root, 'App', 'App')
widget_dir = File.join(root, 'App', 'OttenkiWidget')

FileUtils.cp(%w[WidgetBridge.swift MainViewController.swift App.entitlements].map { |f| File.join(__dir__, f) }, app_dir)
FileUtils.mkdir_p(widget_dir)
FileUtils.cp_r(Dir[File.join(__dir__, 'OttenkiWidget', '*')], widget_dir)

# Главный экран — наш контроллер, который регистрирует плагин WidgetBridge
storyboard = File.join(app_dir, 'Base.lproj', 'Main.storyboard')
sb = File.read(storyboard)
sb.sub!('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="MainViewController" customModule="App" customModuleProvider="target"')
File.write(storyboard, sb)

project = Xcodeproj::Project.open(File.join(root, 'App', 'App.xcodeproj'))
app = project.targets.find { |t| t.name == 'App' } or abort 'нет цели App'

app_group = project.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' } or abort 'нет группы App'
refs = %w[WidgetBridge.swift MainViewController.swift].map { |f| app_group.new_reference(f) }
app.add_file_references(refs)
app_group.new_reference('App.entitlements')
app.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements' }

widget = project.new_target(:app_extension, 'OttenkiWidget', :ios, '17.0')
wgroup = project.main_group.new_group('OttenkiWidget', 'OttenkiWidget')
widget.add_file_references([wgroup.new_reference('OttenkiWidget.swift')])
wgroup.new_reference('Info.plist')
wgroup.new_reference('OttenkiWidget.entitlements')
widget.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'io.github.mihailmoskalenko08.ottenki.widget'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'OttenkiWidget/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['CODE_SIGN_ENTITLEMENTS'] = 'OttenkiWidget/OttenkiWidget.entitlements'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['SKIP_INSTALL'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
end
widget.add_system_framework(%w[WidgetKit SwiftUI])

embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
file = embed.add_file_reference(widget.product_reference, true)
file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
app.add_dependency(widget)

project.save
puts 'виджет добавлен в проект'
