// Worker classique (non-module) : encode du PCM en MP3 via lamejs, hors du thread
// principal pour ne pas geler l'UI sur un fichier audio de plusieurs minutes.
// Charge le build IIFE vendu à côté (voir public/vendor/lamejs.iife.js,
// origine : node_modules/@breezystack/lamejs/dist/lamejs.iife.js).
importScripts('/vendor/lamejs.iife.js')

var BLOCK_SIZE = 1152 // taille de frame standard MPEG, imposée par l'API lamejs

self.onmessage = function (e) {
  var channels = e.data.channels
  var sampleRate = e.data.sampleRate
  var kbps = e.data.kbps
  var left = e.data.left
  var right = e.data.right

  try {
    var encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps)
    var chunks = []
    var totalSamples = left.length

    for (var i = 0; i < totalSamples; i += BLOCK_SIZE) {
      var leftChunk = left.subarray(i, i + BLOCK_SIZE)
      var mp3buf = channels === 2
        ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + BLOCK_SIZE))
        : encoder.encodeBuffer(leftChunk)
      if (mp3buf.length > 0) chunks.push(mp3buf)

      if (i % (BLOCK_SIZE * 200) === 0) {
        self.postMessage({ type: 'progress', progress: Math.round((i / totalSamples) * 100) })
      }
    }

    var end = encoder.flush()
    if (end.length > 0) chunks.push(end)

    var totalLength = 0
    for (var c = 0; c < chunks.length; c++) totalLength += chunks[c].length
    var result = new Uint8Array(totalLength)
    var offset = 0
    for (var j = 0; j < chunks.length; j++) {
      result.set(chunks[j], offset)
      offset += chunks[j].length
    }

    self.postMessage({ type: 'done', mp3: result }, [result.buffer])
  } catch (err) {
    self.postMessage({ type: 'error', message: (err && err.message) ? err.message : String(err) })
  }
}
