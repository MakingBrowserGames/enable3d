/**
 * @author       Yannick Deubel (https://github.com/yandeu)
 * @copyright    Copyright (c) 2019 Yannick Deubel; Project Url: https://github.com/yandeu/enable3d
 * @license      {@link https://github.com/yandeu/enable3d/blob/master/LICENSE|GNU GPLv3}
 */

import EventEmitter = require('eventemitter3')
import { ExtendedObject3D } from '../types'
import ThreeGraphics from '../threeWrapper'
import { Scene3D } from '..'
import DebugDrawer from './debugDrawer'
import { Vector3, Mesh, MeshStandardMaterial } from 'three'

import { ConvexObjectBreaker } from 'three/examples/jsm/misc/ConvexObjectBreaker'
import Shapes from './shapes'

class Physics extends EventEmitter {
  public tmpTrans: Ammo.btTransform
  public physicsWorld: Ammo.btDiscreteDynamicsWorld
  protected dispatcher: Ammo.btCollisionDispatcher
  protected rigidBodies: ExtendedObject3D[] = []
  protected objectsAmmo: { [ptr: number]: any } = {}
  protected earlierDetectedCollisions: { combinedName: string; collision: boolean }[] = []
  protected debugDrawer: DebugDrawer
  private convexBreaker: ConvexObjectBreaker
  protected addRigidBody: (threeObject: ExtendedObject3D, physicsShape: any, mass: any, pos: any, quat: any) => void
  private objectsToRemove: any[]
  private numObjectsToRemove: number

  constructor(protected phaser3D: ThreeGraphics, protected scene: Scene3D) {
    super()
  }

  protected setup() {
    // Initialize convexBreaker
    this.convexBreaker = new ConvexObjectBreaker()

    this.objectsToRemove = []
    this.numObjectsToRemove = 0
    for (var i = 0; i < 500; i++) {
      this.objectsToRemove[i] = null
    }

    // setup ammo physics
    this.setupPhysicsWorld()

    this.debugDrawer = new DebugDrawer(this.phaser3D.scene, this.physicsWorld, {})

    /**
     * TODO add ghost object
     */
    // const ghost = new Ammo.btGhostObject()
    // ghost.setCollisionShape(new Ammo.btSphereShape(10))
    // ghost.setWorldTransform(new Ammo.btTransform(new Ammo.btQuaternion(0, 0, 0, 1), new Ammo.btVector3(0, 15, 0)))
    // ghost.setCollisionFlags(4)
    // this.physicsWorld.addCollisionObject(ghost)

    // run the phaser update method
    if (!this.phaser3D.isXrEnabled)
      this.scene.events.on('update', (_time: number, delta: number) => {
        this.update(delta)
        this.updateDebugger()
      })
  }

  public updateDebugger() {
    if (this.debugDrawer && this.debugDrawer.enabled) this.debugDrawer.update()
  }

  protected setupPhysicsWorld() {
    var gravityConstant = -20

    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
    const broadphase = new Ammo.btDbvtBroadphase()
    const solver = new Ammo.btSequentialImpulseConstraintSolver()
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration)
    this.physicsWorld.setGravity(new Ammo.btVector3(0, gravityConstant, 0))

    this.dispatcher = dispatcher
    this.tmpTrans = new Ammo.btTransform()
  }

  // private createConvexHullPhysicsShapeTEST(coords: any) {
  //   var tempBtVec3_1 = new Ammo.btVector3(0, 0, 0)

  //   var shape = new Ammo.btConvexHullShape()

  //   for (var i = 0, il = coords.length; i < il; i += 3) {
  //     tempBtVec3_1.setValue(coords[i], coords[i + 1], coords[i + 2])
  //     var lastOne = i >= il - 3
  //     shape.addPoint(tempBtVec3_1, lastOne)
  //   }

  //   return shape
  // }

  private createDebrisFromBreakableObject(object: ExtendedObject3D) {
    object.material = new MeshStandardMaterial()
    object.shape = 'hull'
    object.breakable = false

    // Add the object to the scene
    this.phaser3D.scene.add(object)

    // Add physics to the object
    // @ts-ignore
    this.addExisting(object)
  }

  private removeDebris(object: any) {
    // console.log(object.ptr, object.body.ammo)
    this.phaser3D.scene.remove(object)
    this.physicsWorld.removeRigidBody(object.body.ammo)
    delete this.objectsAmmo[object.ptr]
  }

  public update(delta: number) {
    let impactPoint = new Vector3()
    let impactNormal = new Vector3()

    // Step world
    const deltaTime = delta / 1000
    this.physicsWorld.stepSimulation(deltaTime)

    // Update rigid bodies
    for (var i = 0, il = this.rigidBodies.length; i < il; i++) {
      var objThree = this.rigidBodies[i]
      var objPhys = objThree.body.ammo
      var ms = objPhys.getMotionState()

      if (ms) {
        ms.getWorldTransform(this.tmpTrans)
        var p = this.tmpTrans.getOrigin()
        var q = this.tmpTrans.getRotation()
        // body offset
        let o = objThree.body.offset
        objThree.position.set(p.x() + o.x, p.y() + o.y, p.z() + o.z)
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w())

        objThree.collided = false
      }
    }

    // Check collisions
    for (var i = 0, il = this.dispatcher.getNumManifolds(); i < il; i++) {
      var contactManifold = this.dispatcher.getManifoldByIndexInternal(i)

      const key = Object.keys(contactManifold.getBody0())[0]

      // @ts-ignore
      const body0 = Ammo.castObject(contactManifold.getBody0(), Ammo.btRigidBody)
      // @ts-ignore
      const body1 = Ammo.castObject(contactManifold.getBody1(), Ammo.btRigidBody)

      // @ts-ignore
      const ptr0 = body0[key]
      // @ts-ignore
      const ptr1 = body1[key]
      const threeObject0 = this.objectsAmmo[ptr0]
      const threeObject1 = this.objectsAmmo[ptr1]

      // console.log(threeObject0, threeObject1)

      if (!threeObject0 && !threeObject1) {
        continue
      }

      // console.log('threeObject0 section')

      var breakable0 = threeObject0.breakable
      var breakable1 = threeObject1.breakable

      // console.log(breakable0, breakable1)

      var collided0 = threeObject0.collided
      var collided1 = threeObject1.collided

      if ((!breakable0 && !breakable1) || (collided0 && collided1)) {
        continue
      }

      // console.log('contact section')

      var contact = false
      var maxImpulse = 0
      for (var j = 0, jl = contactManifold.getNumContacts(); j < jl; j++) {
        var contactPoint = contactManifold.getContactPoint(j)

        if (contactPoint.getDistance() < 0) {
          contact = true
          var impulse = contactPoint.getAppliedImpulse()

          if (impulse > maxImpulse) {
            maxImpulse = impulse
            var pos = contactPoint.get_m_positionWorldOnB()
            var normal = contactPoint.get_m_normalWorldOnB()
            impactPoint.set(pos.x(), pos.y(), pos.z())
            impactNormal.set(normal.x(), normal.y(), normal.z())
          }

          break
        }
      }

      // If no point has contact, abort
      if (!contact) continue

      // Subdivision
      var fractureImpulse = 5 //250

      // since the library convexBreaker makes use of three's userData
      // we have to clone the necessary params to threeObjectX.userData
      const emptyV3 = new Vector3(0, 0, 0)
      threeObject0.userData = {
        mass: 1,
        velocity: emptyV3,
        angularVelocity: emptyV3,
        breakable: breakable0,
        physicsBody: body0
      }
      threeObject1.userData = {
        mass: 1,
        velocity: emptyV3,
        angularVelocity: emptyV3,
        breakable: breakable1,
        physicsBody: body1
      }

      if (breakable0 && !collided0 && maxImpulse > fractureImpulse) {
        var debris = this.convexBreaker.subdivideByImpact(threeObject0, impactPoint, impactNormal, 1, 2) //, 1.5)

        // console.log(debris)

        var numObjects = debris.length
        for (var j = 0; j < numObjects; j++) {
          var vel = body0.getLinearVelocity()
          var angVel = body0.getAngularVelocity()
          var fragment = debris[j] as ExtendedObject3D
          fragment.userData.velocity.set(vel.x(), vel.y(), vel.z())
          fragment.userData.angularVelocity.set(angVel.x(), angVel.y(), angVel.z())

          this.createDebrisFromBreakableObject(fragment)
        }

        this.objectsToRemove[this.numObjectsToRemove++] = threeObject0
        threeObject0.collided = true
      }

      if (breakable1 && !collided1 && maxImpulse > fractureImpulse) {
        var debris = this.convexBreaker.subdivideByImpact(threeObject1, impactPoint, impactNormal, 1, 2) //, 1.5)

        var numObjects = debris.length
        for (var j = 0; j < numObjects; j++) {
          var vel = body1.getLinearVelocity()
          var angVel = body1.getAngularVelocity()
          var fragment = debris[j] as ExtendedObject3D
          fragment.userData.velocity.set(vel.x(), vel.y(), vel.z())
          fragment.userData.angularVelocity.set(angVel.x(), angVel.y(), angVel.z())

          this.createDebrisFromBreakableObject(fragment)
        }

        this.objectsToRemove[this.numObjectsToRemove++] = threeObject1
        threeObject1.collided = true
      }
    }
    for (var i = 0; i < this.numObjectsToRemove; i++) {
      this.removeDebris(this.objectsToRemove[i])
    }
    this.numObjectsToRemove = 0
  }

  public updateOLD(delta: number) {
    const deltaTime = delta / 1000

    // Step world
    this.physicsWorld.stepSimulation(deltaTime)

    // Collision
    const detectedCollisions: { combinedName: string; collision: boolean }[] = []
    const num = this.dispatcher.getNumManifolds()
    for (let i = 0; i < num; i++) {
      const manifold = this.dispatcher.getManifoldByIndexInternal(i)
      // gets all contact points (edges)
      const num_contacts = manifold.getNumContacts()
      if (num_contacts === 0) {
        continue
      }

      for (let j = 0; j < num_contacts; j++) {
        // const flag0 = manifold.getBody0().getCollisionFlags()
        // const flag1 = manifold.getBody1().getCollisionFlags()
        const key = Object.keys(manifold.getBody0())[0]

        // @ts-ignore
        const ptr0 = manifold.getBody0()[key]
        // @ts-ignore
        const ptr1 = manifold.getBody1()[key]
        // @ts-ignore
        const obj0 = ptr0 in this.objectsAmmo ? this.objectsAmmo[ptr0] : manifold.getBody0()
        // @ts-ignore
        const obj1 = ptr0 in this.objectsAmmo ? this.objectsAmmo[ptr1] : manifold.getBody1()

        // check if a collision between these object has already been processed
        const combinedName = `${obj0.name}__${obj1.name}`

        // console.log(combinedName)
        if (detectedCollisions.find(el => el.combinedName === combinedName)) {
          continue
        }

        let event
        if (this.earlierDetectedCollisions.find(el => el.combinedName === combinedName)) {
          event = 'colliding'
        } else {
          event = 'start'
        }
        detectedCollisions.push({ combinedName, collision: true })

        // const a = manifold.getContactPoint(num_contacts).getPositionWorldOnA()
        // const b = manifold.getContactPoint(num_contacts).getPositionWorldOnB()
        // console.log(a.x(), a.y(), a.z())
        // console.log(b.x(), b.y(), b.z())

        // console.log(pt)
        // console.log(pt.getAppliedImpulse())

        this.emit('collision', { bodies: [obj0, obj1], event })

        // https://stackoverflow.com/questions/31991267/bullet-physicsammo-js-in-asm-js-how-to-get-collision-impact-force
        // console.log('COLLISION DETECTED!')
        // HERE: how to get impact force details?
        // const pt = manifold.getContactPoint(j)
        // pt.getAppliedImpulse() is not working
      }
    }
    // Check which collision ended
    this.earlierDetectedCollisions.forEach(el => {
      const { combinedName } = el
      if (!detectedCollisions.find(el => el.combinedName === combinedName)) {
        const split = combinedName.split('__')
        // console.log(split[0], split[1])
        const obj0 = this.rigidBodies.find(obj => obj.name === split[0])
        const obj1 = this.rigidBodies.find(obj => obj.name === split[1])
        // console.log(obj0, obj1)
        if (obj0 && obj1) this.emit('collision', { bodies: [obj0, obj1], event: 'end' })
      }
    })
    // Update earlierDetectedCollisions
    this.earlierDetectedCollisions = [...detectedCollisions]

    // Update rigid bodies
    for (let i = 0; i < this.rigidBodies.length; i++) {
      let objThree = this.rigidBodies[i]
      // console.log(objThree)
      let objAmmo = objThree.body.ammo
      let ms = objAmmo.getMotionState()
      if (ms) {
        ms.getWorldTransform(this.tmpTrans)
        let p = this.tmpTrans.getOrigin()
        let q = this.tmpTrans.getRotation()
        // body offset
        let o = objThree.body.offset
        objThree.position.set(p.x() + o.x, p.y() + o.y, p.z() + o.z)
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w())
      }
    }
  }
}

export default Physics
