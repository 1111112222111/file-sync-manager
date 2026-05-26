/**
 * src/main/config/filter-manager.ts — 过滤规则管理
 *
 * 职责：维护排除规则列表，判断文件路径是否应被排除。
 */
import { v4 as uuidv4 } from 'uuid';
import type { FilterRule } from '../../shared/types';

export class FilterManager {
  private rules: FilterRule[] = [];

  addRule(pattern: string, enabled = true): FilterRule {
    const rule: FilterRule = { id: uuidv4(), pattern, enabled };
    this.rules.push(rule);
    return rule;
  }

  removeRule(id: string): boolean {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  getRules(): FilterRule[] {
    return [...this.rules];
  }

  shouldExclude(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const fileName = normalized.split('/').pop() ?? normalized;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const regex = this.patternToRegex(rule.pattern);
      if (regex.test(normalized) || regex.test(fileName)) return true;
    }
    return false;
  }

  private patternToRegex(pattern: string): RegExp {
    let regStr = '';
    for (const ch of pattern) {
      switch (ch) {
        case '*': regStr += '.*'; break;
        case '?': regStr += '.'; break;
        case '.': case '+': case '^': case '$': case '{': case '}':
        case '(': case ')': case '|': case '[': case ']': case '\\':
          regStr += '\\' + ch; break;
        default: regStr += ch;
      }
    }
    return new RegExp(regStr);
  }
}
