/**
 * Canonical Project Schema Validation
 *
 * Master Spec §7: one canonical non-destructive project model. Everything
 * that is persisted or crosses a wire boundary is validated against this
 * schema — invalid state is rejected loudly, never silently repaired.
 */
import { z } from 'zod';
import { Project } from './types';
/** Project-level source/generation policy (spec §5/§7). */
export declare const ProjectPolicySchema: z.ZodObject<{
    sources: z.ZodDefault<z.ZodEnum<["user-only", "user+licensed", "user+licensed+generated"]>>;
    allowGeneration: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sources: "user-only" | "user+licensed" | "user+licensed+generated";
    allowGeneration: boolean;
}, {
    sources?: "user-only" | "user+licensed" | "user+licensed+generated" | undefined;
    allowGeneration?: boolean | undefined;
}>;
export type ProjectPolicy = z.infer<typeof ProjectPolicySchema>;
export declare const ProjectSchema: z.ZodObject<{
    meta: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        version: z.ZodNumber;
        schemaVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        version: number;
        createdAt: string;
        updatedAt: string;
        schemaVersion: string;
    }, {
        id: string;
        name: string;
        version: number;
        createdAt: string;
        updatedAt: string;
        schemaVersion: string;
    }>;
    settings: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        fps: z.ZodNumber;
        sampleRate: z.ZodNumber;
        durationMs: z.ZodNumber;
        backgroundColor: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        fps: number;
        sampleRate: number;
        durationMs: number;
        backgroundColor: string;
    }, {
        width: number;
        height: number;
        fps: number;
        sampleRate: number;
        durationMs: number;
        backgroundColor: string;
    }>;
    tracks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["video", "audio", "text", "overlay", "adjustment"]>;
        name: z.ZodString;
        order: z.ZodNumber;
        muted: z.ZodBoolean;
        locked: z.ZodBoolean;
        visible: z.ZodBoolean;
        height: z.ZodNumber;
        clips: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            mediaId: z.ZodString;
            trackId: z.ZodString;
            sourceInMs: z.ZodNumber;
            sourceOutMs: z.ZodNumber;
            timelineStartMs: z.ZodNumber;
            speed: z.ZodNumber;
            reverse: z.ZodBoolean;
            freezeFrameMs: z.ZodOptional<z.ZodNumber>;
            transform: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                scaleX: z.ZodNumber;
                scaleY: z.ZodNumber;
                rotation: z.ZodNumber;
                opacity: z.ZodNumber;
                anchorX: z.ZodNumber;
                anchorY: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            }, {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            }>;
            keyframes: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                timeMs: z.ZodNumber;
                property: z.ZodString;
                value: z.ZodNumber;
                easing: z.ZodUnion<[z.ZodString, z.ZodObject<{
                    type: z.ZodLiteral<"bezier">;
                    x1: z.ZodNumber;
                    y1: z.ZodNumber;
                    x2: z.ZodNumber;
                    y2: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }>]>;
            }, "strip", z.ZodTypeAny, {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }, {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }>, "many">;
            effects: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                effectId: z.ZodString;
                enabled: z.ZodBoolean;
                params: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
                keyframes: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    timeMs: z.ZodNumber;
                    property: z.ZodString;
                    value: z.ZodNumber;
                    easing: z.ZodUnion<[z.ZodString, z.ZodObject<{
                        type: z.ZodLiteral<"bezier">;
                        x1: z.ZodNumber;
                        y1: z.ZodNumber;
                        x2: z.ZodNumber;
                        y2: z.ZodNumber;
                    }, "strip", z.ZodTypeAny, {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    }, {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    }>]>;
                }, "strip", z.ZodTypeAny, {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }, {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }>, "many">;
                mask: z.ZodOptional<z.ZodObject<{
                    type: z.ZodEnum<["rectangle", "ellipse", "path", "track"]>;
                    inverted: z.ZodBoolean;
                    feather: z.ZodNumber;
                    trackId: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                }, {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }, {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }>, "many">;
            volume: z.ZodNumber;
            muted: z.ZodBoolean;
            text: z.ZodOptional<z.ZodObject<{
                text: z.ZodString;
                fontFamily: z.ZodString;
                fontSize: z.ZodNumber;
                fontWeight: z.ZodNumber;
                color: z.ZodString;
                backgroundColor: z.ZodOptional<z.ZodString>;
                alignment: z.ZodEnum<["left", "center", "right"]>;
                animation: z.ZodOptional<z.ZodObject<{
                    type: z.ZodEnum<["none", "fade", "typewriter", "slide", "scale", "custom"]>;
                    durationMs: z.ZodNumber;
                    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
                }, "strip", z.ZodTypeAny, {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                }, {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            }, {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            }>>;
            transitionIn: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                transitionId: z.ZodString;
                durationMs: z.ZodNumber;
                params: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
                easing: z.ZodUnion<[z.ZodString, z.ZodObject<{
                    type: z.ZodLiteral<"bezier">;
                    x1: z.ZodNumber;
                    y1: z.ZodNumber;
                    x2: z.ZodNumber;
                    y2: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }>]>;
            }, "strip", z.ZodTypeAny, {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            }, {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            }>>;
            transitionOut: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                transitionId: z.ZodString;
                durationMs: z.ZodNumber;
                params: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
                easing: z.ZodUnion<[z.ZodString, z.ZodObject<{
                    type: z.ZodLiteral<"bezier">;
                    x1: z.ZodNumber;
                    y1: z.ZodNumber;
                    x2: z.ZodNumber;
                    y2: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }, {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                }>]>;
            }, "strip", z.ZodTypeAny, {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            }, {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            }>>;
            labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            locked: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }, {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "video" | "audio" | "text" | "overlay" | "adjustment";
        height: number;
        id: string;
        name: string;
        order: number;
        muted: boolean;
        locked: boolean;
        visible: boolean;
        clips: {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }[];
    }, {
        type: "video" | "audio" | "text" | "overlay" | "adjustment";
        height: number;
        id: string;
        name: string;
        order: number;
        muted: boolean;
        locked: boolean;
        visible: boolean;
        clips: {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }[];
    }>, "many">;
    media: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        source: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"user">;
            localPath: z.ZodOptional<z.ZodString>;
            cloudId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        }, {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"licensed">;
            provider: z.ZodString;
            assetId: z.ZodString;
            license: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        }, {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"generated">;
            model: z.ZodString;
            prompt: z.ZodString;
            seed: z.ZodOptional<z.ZodNumber>;
            jobId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        }, {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        }>]>;
        type: z.ZodEnum<["video", "audio", "image"]>;
        durationMs: z.ZodNumber;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fps: z.ZodOptional<z.ZodNumber>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        channels: z.ZodOptional<z.ZodNumber>;
        codec: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        proxyPath: z.ZodOptional<z.ZodString>;
        thumbnailPath: z.ZodOptional<z.ZodString>;
        analysis: z.ZodOptional<z.ZodUnknown>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "video" | "audio" | "image";
        durationMs: number;
        id: string;
        createdAt: string;
        source: {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        } | {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        } | {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        };
        updatedAt: string;
        width?: number | undefined;
        height?: number | undefined;
        fps?: number | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
        codec?: string | undefined;
        proxyPath?: string | undefined;
        thumbnailPath?: string | undefined;
        analysis?: unknown;
    }, {
        path: string;
        type: "video" | "audio" | "image";
        durationMs: number;
        id: string;
        createdAt: string;
        source: {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        } | {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        } | {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        };
        updatedAt: string;
        width?: number | undefined;
        height?: number | undefined;
        fps?: number | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
        codec?: string | undefined;
        proxyPath?: string | undefined;
        thumbnailPath?: string | undefined;
        analysis?: unknown;
    }>>;
    markers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timeMs: z.ZodNumber;
        label: z.ZodString;
        color: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        timeMs: number;
        color: string;
        label: string;
    }, {
        id: string;
        timeMs: number;
        color: string;
        label: string;
    }>, "many">;
    captions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        startMs: z.ZodNumber;
        endMs: z.ZodNumber;
        text: z.ZodString;
        style: z.ZodOptional<z.ZodObject<{
            text: z.ZodOptional<z.ZodString>;
            fontFamily: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodNumber>;
            fontWeight: z.ZodOptional<z.ZodNumber>;
            color: z.ZodOptional<z.ZodString>;
            backgroundColor: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            alignment: z.ZodOptional<z.ZodEnum<["left", "center", "right"]>>;
            animation: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<["none", "fade", "typewriter", "slide", "scale", "custom"]>;
                durationMs: z.ZodNumber;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            }, "strip", z.ZodTypeAny, {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            }, {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        }, {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        id: string;
        startMs: number;
        endMs: number;
        style?: {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        } | undefined;
    }, {
        text: string;
        id: string;
        startMs: number;
        endMs: number;
        style?: {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    captions: {
        text: string;
        id: string;
        startMs: number;
        endMs: number;
        style?: {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        } | undefined;
    }[];
    meta: {
        id: string;
        name: string;
        version: number;
        createdAt: string;
        updatedAt: string;
        schemaVersion: string;
    };
    settings: {
        width: number;
        height: number;
        fps: number;
        sampleRate: number;
        durationMs: number;
        backgroundColor: string;
    };
    tracks: {
        type: "video" | "audio" | "text" | "overlay" | "adjustment";
        height: number;
        id: string;
        name: string;
        order: number;
        muted: boolean;
        locked: boolean;
        visible: boolean;
        clips: {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }[];
    }[];
    media: Record<string, {
        path: string;
        type: "video" | "audio" | "image";
        durationMs: number;
        id: string;
        createdAt: string;
        source: {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        } | {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        } | {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        };
        updatedAt: string;
        width?: number | undefined;
        height?: number | undefined;
        fps?: number | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
        codec?: string | undefined;
        proxyPath?: string | undefined;
        thumbnailPath?: string | undefined;
        analysis?: unknown;
    }>;
    markers: {
        id: string;
        timeMs: number;
        color: string;
        label: string;
    }[];
}, {
    captions: {
        text: string;
        id: string;
        startMs: number;
        endMs: number;
        style?: {
            text?: string | undefined;
            backgroundColor?: string | undefined;
            fontFamily?: string | undefined;
            fontSize?: number | undefined;
            fontWeight?: number | undefined;
            color?: string | undefined;
            alignment?: "left" | "center" | "right" | undefined;
            animation?: {
                type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                durationMs: number;
                params?: Record<string, number> | undefined;
            } | undefined;
        } | undefined;
    }[];
    meta: {
        id: string;
        name: string;
        version: number;
        createdAt: string;
        updatedAt: string;
        schemaVersion: string;
    };
    settings: {
        width: number;
        height: number;
        fps: number;
        sampleRate: number;
        durationMs: number;
        backgroundColor: string;
    };
    tracks: {
        type: "video" | "audio" | "text" | "overlay" | "adjustment";
        height: number;
        id: string;
        name: string;
        order: number;
        muted: boolean;
        locked: boolean;
        visible: boolean;
        clips: {
            reverse: boolean;
            volume: number;
            speed: number;
            id: string;
            muted: boolean;
            locked: boolean;
            mediaId: string;
            trackId: string;
            sourceInMs: number;
            sourceOutMs: number;
            timelineStartMs: number;
            transform: {
                x: number;
                y: number;
                scaleX: number;
                scaleY: number;
                rotation: number;
                opacity: number;
                anchorX: number;
                anchorY: number;
            };
            keyframes: {
                value: number;
                id: string;
                timeMs: number;
                property: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
            }[];
            effects: {
                params: Record<string, string | number | boolean>;
                id: string;
                keyframes: {
                    value: number;
                    id: string;
                    timeMs: number;
                    property: string;
                    easing: string | {
                        type: "bezier";
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                    };
                }[];
                effectId: string;
                enabled: boolean;
                mask?: {
                    type: "path" | "rectangle" | "ellipse" | "track";
                    inverted: boolean;
                    feather: number;
                    trackId?: string | undefined;
                } | undefined;
            }[];
            text?: {
                text: string;
                fontFamily: string;
                fontSize: number;
                fontWeight: number;
                color: string;
                alignment: "left" | "center" | "right";
                backgroundColor?: string | undefined;
                animation?: {
                    type: "custom" | "none" | "fade" | "typewriter" | "slide" | "scale";
                    durationMs: number;
                    params?: Record<string, number> | undefined;
                } | undefined;
            } | undefined;
            freezeFrameMs?: number | undefined;
            transitionIn?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            transitionOut?: {
                params: Record<string, string | number | boolean>;
                durationMs: number;
                id: string;
                easing: string | {
                    type: "bezier";
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                };
                transitionId: string;
            } | undefined;
            labels?: string[] | undefined;
        }[];
    }[];
    media: Record<string, {
        path: string;
        type: "video" | "audio" | "image";
        durationMs: number;
        id: string;
        createdAt: string;
        source: {
            kind: "user";
            localPath?: string | undefined;
            cloudId?: string | undefined;
        } | {
            kind: "licensed";
            provider: string;
            assetId: string;
            license: string;
        } | {
            kind: "generated";
            model: string;
            prompt: string;
            jobId: string;
            seed?: number | undefined;
        };
        updatedAt: string;
        width?: number | undefined;
        height?: number | undefined;
        fps?: number | undefined;
        sampleRate?: number | undefined;
        channels?: number | undefined;
        codec?: string | undefined;
        proxyPath?: string | undefined;
        thumbnailPath?: string | undefined;
        analysis?: unknown;
    }>;
    markers: {
        id: string;
        timeMs: number;
        color: string;
        label: string;
    }[];
}>;
export declare function validateProject(project: unknown): Project;
export declare function parseProject(json: string): Project;
