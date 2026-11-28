package expo.modules.personsegmentation

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceContour
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * On-device person cut-out and portrait analysis for passport photos (Google ML Kit).
 * All coordinates are pixels of the decoded image (no EXIF rotation is applied, matching
 * the Skia-encoded JPEGs the app passes in).
 */
class PersonSegmentationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PersonSegmentation")

    // Returns a PNG the size of the input: white, with alpha = how surely each pixel is the person.
    AsyncFunction("segmentPerson") { uri: String ->
      val bitmap = decode(uri)
      val input = InputImage.fromBitmap(bitmap, 0)
      val confidence = subjectMask(input, bitmap.width, bitmap.height)
        ?: selfieMask(input, bitmap.width, bitmap.height)
        ?: throw CodedException("ERR_SEGMENT", "Could not find a person in this photo.", null)

      val width = bitmap.width
      val height = bitmap.height
      val pixels = IntArray(width * height)
      for (i in pixels.indices) {
        val a = (confidence.get(i).coerceIn(0f, 1f) * 255f).toInt()
        pixels[i] = (a shl 24) or 0xFFFFFF
      }
      val mask = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      mask.setPixels(pixels, 0, width, 0, 0, width, height)
      val file = File(appContext.cacheDirectory, "person-mask-${System.currentTimeMillis()}.png")
      FileOutputStream(file).use { mask.compress(Bitmap.CompressFormat.PNG, 100, it) }
      mask.recycle()
      bitmap.recycle()
      mapOf("uri" to Uri.fromFile(file).toString(), "width" to width, "height" to height)
    }

    // The largest face (eyes, chin, box, roll) and the shoulders, if visible.
    AsyncFunction("analyzePortrait") { uri: String ->
      val bitmap = decode(uri)
      val input = InputImage.fromBitmap(bitmap, 0)

      val faceDetector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
          .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
          .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
          .build()
      )
      val faces = try { Tasks.await(faceDetector.process(input)) } finally { faceDetector.close() }
      val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }

      var faceMap: Map<String, Any?>? = null
      if (face != null) {
        val box = face.boundingBox
        val eyes = listOfNotNull(
          face.getLandmark(FaceLandmark.LEFT_EYE)?.position,
          face.getLandmark(FaceLandmark.RIGHT_EYE)?.position,
        ).map { mapOf("x" to it.x.toDouble(), "y" to it.y.toDouble()) }
        val chin = face.getContour(FaceContour.FACE)?.points?.maxByOrNull { it.y }
        faceMap = mapOf(
          "x" to box.left.toDouble(),
          "y" to box.top.toDouble(),
          "width" to box.width().toDouble(),
          "height" to box.height().toDouble(),
          "eyes" to eyes,
          "chin" to (chin?.let { mapOf("x" to it.x.toDouble(), "y" to it.y.toDouble()) }),
          "roll" to face.headEulerAngleZ.toDouble(),
        )
      }

      val poseDetector = PoseDetection.getClient(
        PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.SINGLE_IMAGE_MODE).build()
      )
      val pose = try { Tasks.await(poseDetector.process(input)) } catch (e: Exception) { null } finally { poseDetector.close() }
      val shoulders = listOfNotNull(
        pose?.getPoseLandmark(PoseLandmark.LEFT_SHOULDER),
        pose?.getPoseLandmark(PoseLandmark.RIGHT_SHOULDER),
      ).map {
        mapOf(
          "x" to it.position.x.toDouble(),
          "y" to it.position.y.toDouble(),
          "confidence" to it.inFrameLikelihood.toDouble(),
        )
      }

      val result = mapOf("width" to bitmap.width, "height" to bitmap.height, "face" to faceMap, "shoulders" to shoulders)
      bitmap.recycle()
      result
    }
  }

  private fun decode(uri: String): Bitmap {
    val path = Uri.parse(uri).path ?: uri
    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    return BitmapFactory.decodeFile(path, options)
      ?: throw CodedException("ERR_IMAGE", "Could not read this image.", null)
  }

  /** Subject Segmentation (best quality). Null if the Play services model isn't ready yet. */
  private fun subjectMask(input: InputImage, w: Int, h: Int): FloatBuffer? {
    val segmenter = SubjectSegmentation.getClient(
      SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build()
    )
    return try {
      val buffer = Tasks.await(segmenter.process(input)).foregroundConfidenceMask
      if (buffer != null && buffer.capacity() >= w * h) buffer.apply { rewind() } else null
    } catch (e: Exception) {
      null
    } finally {
      segmenter.close()
    }
  }

  /** Selfie Segmentation (bundled, works offline right away). */
  private fun selfieMask(input: InputImage, w: Int, h: Int): FloatBuffer? {
    val segmenter = Segmentation.getClient(
      SelfieSegmenterOptions.Builder().setDetectorMode(SelfieSegmenterOptions.SINGLE_IMAGE_MODE).build()
    )
    return try {
      val mask = Tasks.await(segmenter.process(input))
      if (mask.width != w || mask.height != h) return null
      mask.buffer.order(ByteOrder.nativeOrder()).asFloatBuffer().apply { rewind() }
    } catch (e: Exception) {
      null
    } finally {
      segmenter.close()
    }
  }
}
