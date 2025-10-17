import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileSignature } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function PendingTasksCard() {
  const { data: trainings } = useQuery({
    queryKey: ["/api/trainings"],
  });

  const { data: userTrainings } = useQuery({
    queryKey: ["/api/user-trainings"],
  });

  // Mock pending tasks - in a real app, this would come from an API
  const getPendingTasks = () => {
    const tasks = [];
    
    // Check for incomplete required trainings
    if (trainings && userTrainings) {
      const requiredTrainings = trainings.filter((t: any) => t.isRequired);
      const completedTrainingIds = userTrainings
        .filter((ut: any) => ut.status === 'completed')
        .map((ut: any) => ut.trainingId);
      
      const incompleteRequiredTrainings = requiredTrainings.filter(
        (t: any) => !completedTrainingIds.includes(t.id)
      );
      
      incompleteRequiredTrainings.forEach((training: any) => {
        tasks.push({
          id: `training-${training.id}`,
          type: 'training',
          title: 'Complete Training',
          description: training.title,
          priority: 'high',
          action: 'Start',
        });
      });
    }

    // Add a mock document review task
    tasks.push({
      id: 'document-review-1',
      type: 'document',
      title: 'Review Document',
      description: 'Updated Employee Handbook',
      priority: 'medium',
      action: 'Review',
    });

    return tasks;
  };

  const pendingTasks = getPendingTasks();

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-white">Medium Priority</Badge>;
      default:
        return <Badge variant="secondary">Low Priority</Badge>;
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'document':
        return <FileSignature className="w-4 h-4 text-primary" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTaskBg = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/10 border-destructive/20';
      case 'medium':
        return 'bg-warning/10 border-warning/20';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  return (
    <Card data-testid="pending-tasks-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getTaskBg(task.priority)}`}
                data-testid={`pending-task-${task.id}`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  {getTaskIcon(task.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" data-testid={`task-title-${task.id}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`task-description-${task.id}`}>
                      {task.description}
                    </p>
                    <div className="mt-1">
                      {getPriorityBadge(task.priority)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={task.priority === 'high' ? 'bg-destructive hover:bg-destructive/90' : ''}
                  data-testid={`task-action-${task.id}`}
                >
                  {task.action}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" data-testid="no-pending-tasks">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No pending tasks</p>
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
