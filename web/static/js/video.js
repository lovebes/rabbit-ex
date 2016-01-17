/* jshint esnext: true */
import socket from './socket'

// Add important functions to video element
function polyfill(video) {
  video.requestFullscreen = video.requestFullscreen || video.msRequestFullscreen || video.mozRequestFullScreen || video.webkitRequestFullscreen
  document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen

  video.togglePlaying = () => {
    if (video.paused)
      video.play()
    else
      video.pause()
  }

  video.toggleFullScreen = () => {
    if (document.webkitFullscreenElement)
      document.exitFullscreen()
    else
      video.requestFullscreen()
  }

  // Resets the video element
  video.destroy = () => {
    video.src = ''
    video.load()
  }
}

export var run = function(video = document.getElementById('main-video'),
                          $controller = $('#controller'),
                          channelName = undefined) {
  $('video').each((i, v) => {
    polyfill(v)
  })

  let $video = $(video)
  let $window = $(window)

  video.resize = () => {
    $video.css({
      'height': $window.height() + 'px',
      'width': $window.width() + 'px'
    })
  }

  window.onresize = video.resize

  video.volumeStep = 0.05
  video.skipStep = 3

  window.controlling = false

  // Key codes
  let keys = {
    space: 32,
    arrow: {
      right: 39,
      left: 37,
      up: 38,
      down: 40
    },
    p: 80,
    f: 70
  }

  // To slow down fast forwarding with the keyboard
  // Debouncing
  let keyboardDelay = false
  setInterval(() => {
    keyboardDelay = false
  }, 300)

  $video.on('click', video.togglePlaying)
  $video.on('dblclick', video.toggleFullScreen)

  window.addEventListener('keydown', (e) => {
    if (!$video.is(':hover')) {
      return;
    }
    let key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0
    switch (key) {
    case keys.arrow.right:
      if (!keyboardDelay) {
        keyboardDelay = true
        video.currentTime += video.skipStep
      }
      e.preventDefault()
      break
    case keys.arrow.left:
      if (!keyboardDelay) {
        keyboardDelay = true
        video.currentTime -= video.skipStep
      }
      e.preventDefault()
      break
    case keys.arrow.up:
      if (video.volume + video.volumeStep >= 1)
        video.volume = 1
      else
        video.volume += video.volumeStep
      e.preventDefault()
      break
    case keys.arrow.down:
      if (video.volume - video.volumeStep <= 0)
        video.volume = 0
      else
        video.volume -= video.volumeStep
      e.preventDefault()
      break
    case keys.space:
    case keys.p:
      video.togglePlaying()
      e.preventDefault()
      break
    case keys.f:
      video.toggleFullScreen()
      e.preventDefault()
      break
    }
  })

  video.resize()

  // Channel stuff
  video.streamId = video.src.split('/').pop()
  let channel = channelName ? socket.channel(`video:${channelName}`) :
        socket.channel(`video:${video.streamId}`, {})
  video.channel = channel

  channel.on('play', payload => {
    video.currentTime = payload.currentTime + video.latency
    video.play()
  })
  video.onplay = () => {
    if (window.controlling)
      channel.push('play', {currentTime: video.currentTime + video.latency})
  }

  channel.on('pause', payload => {
    video.currentTime = payload.currentTime
    video.pause()
  })
  video.onpause = () => {
    if (window.controlling)
      channel.push('pause', {currentTime: video.currentTime})
  }

  channel.join()
    .receive('ok', resp => { console.log('Joined successfully', resp) })
    .receive('error', resp => { console.log('Unable to join', resp) })

  var startTime
  function ping() {
    startTime = Date.now()
    channel.push('ping', {})
  }
  setInterval(ping, 1000)
  channel.on('pong', () => {
    video.latency = (Date.now() - startTime) / 1000 // ms to s
  })

  let $caption = $('#caption')
  video.displayingCaption = false

  video.captionTimeout = 3000
  video.displayCaption = (caption, time, important) => {
    function resetCaption () {
      $caption.text('')
      video.displayingCaption = false
    }

    if (!video.displayingCaption) {
      if (important)
        video.displayingCaption = true
      $caption.text(caption)
      if (time)
        setTimeout(resetCaption, time)
      else
        setTimeout(resetCaption, video.captionTimeout)
    }
  }

  function humanizeSeconds(seconds) {
    var date = new Date(null)
    date.setSeconds(seconds)
    // hh:mm:ss
    return date.toISOString().substr(11, 8)
  }

  video.addEventListener('mousemove', () => {
    video.displayCaption(
      `${humanizeSeconds(video.duration - video.currentTime)} remaining`)
  })

  function setController(bool) {
    window.controlling = bool
    if (window.controlling) {
      channel.push('taken_control', {})
      $controller.text('You are controlling the video')
    } else {
      $controller.text('Take control')
    }
  }

  setController(false)

  var toggleController = () => {
    setController(!window.controlling)
  }
  $controller.on('click', toggleController)

  channel.on('taken_control', () => {
    setController(false)
  })

  video.partnerTime = 0
  setInterval(() => {
    channel.push('time_update', {currentTime: video.currentTime + video.latency})
  }, 500)
  channel.on('time_update', payload => {
    video.partnerTime = payload.currentTime + video.latency
  })

  channel.on('redirect', payload => {
    window.location.href = `/video/${payload.location}`
  })

  video.redirect = (loc) => {
    channel.push('redirect', {location: loc})
  }

  return {
    teardown: () => {
      $controller.off('click', toggleController)
      $video.off('click', video.togglePlaying)
      $video.off('dblclick', video.toggleFullScreen)
      video.destroy()
      channel.leave()
    },
    video: video
  }
}
