/**
 * @module ol/interaction/DragPan
 */
import ViewHint from '../ViewHint.js';
import {scale as scaleCoordinate, rotate as rotateCoordinate, add as addCoordinate} from '../coordinate.js';
import {easeOut} from '../easing.js';
import {noModifierKeys} from '../events/condition.js';
import {FALSE} from '../functions.js';
import PointerInteraction, {centroid as centroidFromPointers} from './Pointer.js';
import ViewProperty from '../ViewProperty';


/**
 * @typedef {Object} Options
 * @property {import("../events/condition.js").Condition} [condition] A function that takes an {@link module:ol/MapBrowserEvent~MapBrowserEvent} and returns a boolean
 * to indicate whether that event should be handled.
 * Default is {@link module:ol/events/condition~noModifierKeys}.
 * @property {import("../Kinetic.js").default} [kinetic] Kinetic inertia to apply to the pan.
 */


/**
 * @classdesc
 * Allows the user to pan the map by dragging the map.
 * @api
 */
class DragPan extends PointerInteraction {
  /**
   * @param {Options=} opt_options Options.
   */
  constructor(opt_options) {

    super({
      stopDown: FALSE
    });

    const options = opt_options ? opt_options : {};

    /**
     * @private
     * @type {import("../Kinetic.js").default|undefined}
     */
    this.kinetic_ = options.kinetic;

    /**
     * @type {import("../pixel.js").Pixel}
     */
    this.initialCentroid = null;

    /**
     * @type {import("../coordinate.js").Coordinate}
     */
    this.initialCenter = null;

    /**
     * @type {import("../coordinate.js").Coordinate}
     */
    this.lastCenter = null;

    /**
     * @type {number}
     */
    this.lastPointersCount_;

    /**
     * @private
     * @type {import("../events/condition.js").Condition}
     */
    this.condition_ = options.condition ? options.condition : noModifierKeys;

    /**
     * @private
     * @type {boolean}
     */
    this.noKinetic_ = false;

  }

  /**
   * @inheritDoc
   */
  handleDragEvent(mapBrowserEvent) {
    const targetPointers = this.targetPointers;
    const centroid = centroidFromPointers(targetPointers);
    const map = mapBrowserEvent.map;
    const view = map.getView();
    if (targetPointers.length == this.lastPointersCount_) {
      if (this.kinetic_) {
        this.kinetic_.update(centroid[0], centroid[1]);
      }
      if (view.getAnimating()) {
        view.cancelAnimations();
      }
      if (this.initialCentroid) {
        const deltaX = this.initialCentroid[0] - centroid[0];
        const deltaY = centroid[1] - this.initialCentroid[1];
        const map = mapBrowserEvent.map;
        const view = map.getView();
        const center = [deltaX, deltaY];
        scaleCoordinate(center, view.getResolution());
        rotateCoordinate(center, view.getRotation());
        addCoordinate(center, this.initialCenter);
        this.lastCenter = center;
        view.setCenter(center);
      }
    } else if (this.kinetic_) {
      // reset so we don't overestimate the kinetic energy after
      // after one finger down, tiny drag, second finger down
      this.kinetic_.begin();
    }
    this.lastPointersCount_ = targetPointers.length;
  }

  /**
   * @inheritDoc
   */
  handleUpEvent(mapBrowserEvent) {
    const map = mapBrowserEvent.map;
    const view = map.getView();
    if (this.targetPointers.length === 0) {
      if (!this.noKinetic_ && this.kinetic_ && this.kinetic_.end()) {
        const distance = this.kinetic_.getDistance();
        const angle = this.kinetic_.getAngle();
        const center = this.lastCenter;
        const centerpx = map.getPixelFromCoordinate(center);
        const dest = map.getCoordinateFromPixel([
          centerpx[0] - distance * Math.cos(angle),
          centerpx[1] - distance * Math.sin(angle)
        ]);
        // we force the view center without constraint to have
        // the proper initial center when animating
        view.set(ViewProperty.CENTER, this.lastCenter);
        view.animate({
          center: dest,
          duration: 500,
          easing: easeOut
        }, function(succeeded) {
          // we force the final view center so that
          // the constraint resolution plays from the correct point
          if (succeeded) {
            view.set(ViewProperty.CENTER, dest);
          }
          view.setHint(ViewHint.INTERACTING, -1);
        }.bind(this));
      } else {
        view.set(ViewProperty.CENTER, this.lastCenter);
        view.setHint(ViewHint.INTERACTING, -1);
        view.resolveConstraints();
      }
      return false;
    } else {
      if (this.kinetic_) {
        // reset so we don't overestimate the kinetic energy after
        // after one finger up, tiny drag, second finger up
        this.kinetic_.begin();
      }
      this.initialCentroid = null;
      this.initialCenter = null;
      return true;
    }
  }

  /**
   * @inheritDoc
   */
  handleDownEvent(mapBrowserEvent) {
    if (this.targetPointers.length > 0 && this.condition_(mapBrowserEvent)) {
      const map = mapBrowserEvent.map;
      const view = map.getView();

      // stop any current animation
      this.getMap().getView().setHint(ViewHint.INTERACTING, 1);

      if (view.getAnimating()) {
        view.cancelAnimations();
      }

      const targetPointers = this.targetPointers;
      this.initialCentroid = centroidFromPointers(targetPointers);
      this.initialCenter = view.getCenter();
      this.lastCenter = view.getCenter();

      if (this.kinetic_) {
        this.kinetic_.begin();
      }
      // No kinetic as soon as more than one pointer on the screen is
      // detected. This is to prevent nasty pans after pinch.
      this.noKinetic_ = this.targetPointers.length > 1;
      return true;
    } else {
      return false;
    }
  }
}

export default DragPan;
