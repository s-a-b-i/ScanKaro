import CoreImage
import ExpoModulesCore
import UIKit
import Vision

/**
 * On-device person cut-out and portrait analysis for passport photos (Apple Vision).
 * All coordinates are pixels of the image, origin top-left, matching the Android module.
 */
public class PersonSegmentationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PersonSegmentation")

    // Returns a PNG the size of the input: white, with alpha = how surely each pixel is the person.
    AsyncFunction("segmentPerson") { (uri: String) -> [String: Any] in
      let image = try Self.loadImage(uri)
      let width = image.width
      let height = image.height

      let request = VNGeneratePersonSegmentationRequest()
      request.qualityLevel = .accurate
      request.outputPixelFormat = kCVPixelFormatType_OneComponent8
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
      guard let buffer = request.results?.first?.pixelBuffer else {
        throw Exception(name: "ERR_SEGMENT", description: "Could not find a person in this photo.")
      }

      // Scale the (smaller) mask up to the image and read it as one byte per pixel.
      let mask = CIImage(cvPixelBuffer: buffer)
      let scaled = mask.transformed(by: CGAffineTransform(
        scaleX: CGFloat(width) / mask.extent.width,
        y: CGFloat(height) / mask.extent.height
      ))
      var alpha = [UInt8](repeating: 0, count: width * height)
      CIContext(options: [.useSoftwareRenderer: false]).render(
        scaled,
        toBitmap: &alpha,
        rowBytes: width,
        bounds: CGRect(x: 0, y: 0, width: width, height: height),
        format: .L8,
        colorSpace: nil
      )

      // White, premultiplied by the mask.
      var rgba = [UInt8](repeating: 0, count: width * height * 4)
      for i in 0..<(width * height) {
        let a = alpha[i]
        rgba[i * 4] = a
        rgba[i * 4 + 1] = a
        rgba[i * 4 + 2] = a
        rgba[i * 4 + 3] = a
      }
      // The context only borrows the bytes, so make the image while they are pinned.
      let cgMask: CGImage? = rgba.withUnsafeMutableBytes { bytes in
        CGContext(
          data: bytes.baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width * 4,
          space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )?.makeImage()
      }
      guard let cgMask, let png = UIImage(cgImage: cgMask).pngData() else {
        throw Exception(name: "ERR_SEGMENT", description: "Could not save the cut-out.")
      }
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("person-mask-\(Int(Date().timeIntervalSince1970 * 1000)).png")
      try png.write(to: url)
      return ["uri": url.absoluteString, "width": width, "height": height]
    }

    // The largest face (eyes, chin, box, roll) and the shoulders, if visible.
    AsyncFunction("analyzePortrait") { (uri: String) -> [String: Any] in
      let image = try Self.loadImage(uri)
      let w = CGFloat(image.width)
      let h = CGFloat(image.height)
      let size = CGSize(width: w, height: h)
      // Vision uses normalised coordinates with the origin at the bottom-left.
      func point(_ p: CGPoint) -> [String: Double] { ["x": Double(p.x), "y": Double(h - p.y)] }

      let faceRequest = VNDetectFaceLandmarksRequest()
      let poseRequest = VNDetectHumanBodyPoseRequest()
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([faceRequest, poseRequest])

      var result: [String: Any] = ["width": image.width, "height": image.height, "shoulders": [[String: Double]]()]

      let faces = faceRequest.results ?? []
      if let face = faces.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }) {
        let box = VNImageRectForNormalizedRect(face.boundingBox, image.width, image.height)
        var faceMap: [String: Any] = [
          "x": Double(box.minX),
          "y": Double(h - box.maxY),
          "width": Double(box.width),
          "height": Double(box.height),
          "roll": (face.roll?.doubleValue ?? 0) * 180 / .pi,
        ]
        var eyes: [[String: Double]] = []
        for pupil in [face.landmarks?.leftPupil, face.landmarks?.rightPupil] {
          if let p = pupil?.pointsInImage(imageSize: size).first { eyes.append(point(p)) }
        }
        faceMap["eyes"] = eyes
        // Lowest point of the jaw line (largest y once flipped = smallest Vision y).
        if let chin = face.landmarks?.faceContour?.pointsInImage(imageSize: size).min(by: { $0.y < $1.y }) {
          faceMap["chin"] = point(chin)
        }
        result["face"] = faceMap
      }

      if let body = poseRequest.results?.first {
        var shoulders: [[String: Double]] = []
        for joint in [VNHumanBodyPoseObservation.JointName.leftShoulder, .rightShoulder] {
          if let p = try? body.recognizedPoint(joint), p.confidence > 0 {
            var m = point(CGPoint(x: p.location.x * w, y: p.location.y * h))
            m["confidence"] = Double(p.confidence)
            shoulders.append(m)
          }
        }
        result["shoulders"] = shoulders
      }
      return result
    }
  }

  private static func loadImage(_ uri: String) throws -> CGImage {
    let path = URL(string: uri)?.path ?? uri
    guard let image = UIImage(contentsOfFile: path)?.cgImage else {
      throw Exception(name: "ERR_IMAGE", description: "Could not read this image.")
    }
    return image
  }
}
