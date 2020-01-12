/**
 * This article helped a lot!
 * https://medium.com/@bluemagnificent/intro-to-javascript-3d-physics-using-ammo-js-and-three-js-dd48df81f591
 */

import { Object3D, Scene3D, ExtendedObject3D } from 'enable3d'
import Robot from '../objects/robot'

export default class MainScene extends Scene3D {
  sphere: Object3D
  hero: ExtendedObject3D
  robot: ExtendedObject3D
  keys: any
  gameOver: boolean
  playerCanJump = false
  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.requestThirdDimension()
    delete this.hero
    delete this.robot
    this.gameOver = false
  }

  create() {
    // TODO enable to use negative string e.g. '-ground' remove ground from the features
    this.accessThirdDimension()
    this.third.warpSpeed()

    this.third.physics.debug.enable()

    this.third.physics.add.box({ y: 1, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })
    this.third.physics.add.box({ y: 5, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })
    this.third.physics.add.box({ y: 9, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })
    this.third.physics.add.box({ y: 13, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })
    this.third.physics.add.box({ y: 17, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })
    this.third.physics.add.box({ y: 21, x: 8, z: 6, width: 4, height: 4, depth: 4, breakable: true })

    this.third.physics.add.box({ y: 1, x: -10, z: 8, width: 10, height: 8, depth: 10, breakable: true })

    this.third.physics.add.sphere({ y: 1, x: -10, z: -5, radius: 5, breakable: true })

    this.third.physics.add.cylinder({ y: 1, x: 10, z: -5, height: 10, breakable: true })
    this.third.physics.add.cylinder({ y: 1, x: 13, z: -5, height: 10, breakable: true })
    this.third.physics.add.cylinder({ y: 1, x: 15, z: -5, height: 10, breakable: true })

    const raycaster = this.third.new.raycaster()
    const force = 50

    this.input.on('pointerdown', (pointer: PointerEvent) => {
      // calculate mouse position in normalized device coordinates
      // (-1 to +1) for both components
      const x = (pointer.x / this.cameras.main.width) * 2 - 1
      const y = -(pointer.y / this.cameras.main.height) * 2 + 1
      raycaster.setFromCamera({ x, y }, this.third.camera)

      const pos = this.third.new.vector3()

      pos.copy(raycaster.ray.direction)
      pos.add(raycaster.ray.origin)

      const sphere = this.third.physics.add.sphere(
        { radius: 0.4, x: pos.x, y: pos.y, z: pos.z, mass: 20 },
        { phong: { color: 0x202020 } }
      )

      pos.copy(raycaster.ray.direction)
      pos.multiplyScalar(24)

      sphere.body.applyForce(pos.x * force, pos.y * force, pos.z * force)
    })

    // conversion test
    // TODO does only work if x and y is set to 0
    // so we have to calculate the x and y offset

    // add 3 rectangles at the top of the screen
    // two are 2 dimensional, one is 3 dimensional
    let pps10 = this.third.getPixelsPerSquare(10)
    const { width, height } = this.cameras.main

    this.add.rectangle(width / 2 + pps10, pps10, pps10, pps10, 0xff00ff)
    const positionIn3d = this.third.transform.from2dto3d(width / 2, pps10, 10)
    this.third.add.box({ ...positionIn3d })

    let ppsM5 = this.third.getPixelsPerSquare(-5)
    this.third.add.box({ x: 10, y: 3, z: -5 })
    const positionIn2d = this.third.transform.from3dto2d(this.third.new.vector3(10, 3, -5))
    this.add.rectangle(positionIn2d.x + ppsM5, positionIn2d.y, ppsM5, ppsM5, 0xff00ff)

    // add phaser texts
    // one in the front
    // and another in the back with a depth or <= -1
    this.add.text(10, 10, 'Text in Front', { color: 0x00ff00, fontSize: '50px' })
    this.add
      .text(this.cameras.main.width - 10, 10, 'Text in Back', { color: 0x00ff00, fontSize: '50px' })
      .setOrigin(1, 0)
      .setDepth(-1)
  }
}
