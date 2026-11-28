Pod::Spec.new do |s|
  s.name           = 'PersonSegmentation'
  s.version        = '0.1.0'
  s.summary        = 'On-device person cut-out and portrait analysis (Apple Vision).'
  s.description    = 'Person segmentation, face and body pose for ScanKaro passport photos.'
  s.license        = 'MIT'
  s.author         = 'ScanKaro'
  s.homepage       = 'https://github.com/s-a-b-i/ScanKaro'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
