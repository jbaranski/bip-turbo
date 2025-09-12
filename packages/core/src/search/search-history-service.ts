import type { SearchHistory, CreateSearchHistory, UpdateSearchHistory } from "@bip/domain";
import type { SearchHistoryRepository } from "./search-history-repository";

export class SearchHistoryService {
  constructor(private repository: SearchHistoryRepository) {}

  async create(data: CreateSearchHistory): Promise<SearchHistory> {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateSearchHistory): Promise<SearchHistory> {
    return this.repository.update(id, data);
  }
}