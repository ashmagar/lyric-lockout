import type { DifficultyLevel, VideoType } from '../enums';

export interface Challenge {
  id: string;
  difficulty: DifficultyLevel;
  playbackStartSeconds: number;
  pauseAtSeconds: number;
  verifyFromSeconds: number;
  verifyToSeconds?: number | undefined;
  expectedLyrics: string;
  missingWordCount: number;
  hintText: string;
  enabled: boolean;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface Song {
  id: string;
  schemaVersion: number;
  title: string;
  artist: string;
  youtubeVideoId: string;
  videoType: VideoType;
  categoryIds: string[];
  language?: string | undefined;
  releaseYear?: number | undefined;
  movieOrAlbum?: string | undefined;
  thumbnailUrl?: string | undefined;
  enabled: boolean;
  notes?: string | undefined;
  challenges: Challenge[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string | undefined;
  icon?: string | undefined;
  displayOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogData {
  categories: Category[];
  songs: Song[];
}
